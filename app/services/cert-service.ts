import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const CA_DIR = process.env.MQTT_CA_DIR || "/certs/mqtt-ca";
const ACL_FILE = process.env.MQTT_ACL_FILE || "/mosquitto/config/acl";

interface CertBundle {
	cert: string;
	key: string;
	caCert: string;
}

function getCaPaths() {
	const caKey = path.join(CA_DIR, "ca.key");
	const caCert = path.join(CA_DIR, "ca.crt");
	if (!fs.existsSync(caKey) || !fs.existsSync(caCert)) {
		throw new Error(`CA files not found at ${CA_DIR}. Ensure mqtt-ca secret is mounted.`);
	}
	return { caKey, caCert };
}

export function issueDeviceCert(tenantId: string, deviceId: string): CertBundle {
	const { caKey, caCert } = getCaPaths();
	const cn = `${tenantId}:${deviceId}`;

	// Create a temp directory for cert generation
	const tmpDir = fs.mkdtempSync("/tmp/mqtt-cert-");

	try {
		const keyPath = path.join(tmpDir, "client.key");
		const csrPath = path.join(tmpDir, "client.csr");
		const certPath = path.join(tmpDir, "client.crt");

		// Generate RSA 2048 key
		execSync(`openssl genrsa -out "${keyPath}" 2048`, { stdio: "pipe" });

		// Create CSR
		execSync(
			`openssl req -new -key "${keyPath}" -out "${csrPath}" -subj "/C=DE/O=${tenantId}/CN=${cn}"`,
			{ stdio: "pipe" },
		);

		// Sign with CA (2 year validity)
		execSync(
			`openssl x509 -req -in "${csrPath}" -CA "${caCert}" -CAkey "${caKey}" -CAcreateserial -out "${certPath}" -days 730 -sha256`,
			{ stdio: "pipe" },
		);

		const bundle: CertBundle = {
			cert: fs.readFileSync(certPath, "utf-8"),
			key: fs.readFileSync(keyPath, "utf-8"),
			caCert: fs.readFileSync(caCert, "utf-8"),
		};

		return bundle;
	} finally {
		// Clean up temp dir
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
}

export function appendAclEntry(tenantId: string, deviceId: string): void {
	const cn = `${tenantId}:${deviceId}`;
	const entry = `\nuser ${cn}\ntopic readwrite tenant/${tenantId}/device/${deviceId}/#\n`;

	// Check if entry already exists
	if (fs.existsSync(ACL_FILE)) {
		const existing = fs.readFileSync(ACL_FILE, "utf-8");
		if (existing.includes(`user ${cn}`)) {
			return; // Already exists
		}
	}

	fs.appendFileSync(ACL_FILE, entry);
}

export function removeAclEntry(tenantId: string, deviceId: string): void {
	const cn = `${tenantId}:${deviceId}`;

	if (!fs.existsSync(ACL_FILE)) return;

	const lines = fs.readFileSync(ACL_FILE, "utf-8").split("\n");
	const filtered: string[] = [];
	let skip = false;

	for (const line of lines) {
		if (line.trim() === `user ${cn}`) {
			skip = true;
			continue;
		}
		if (skip && line.trim().startsWith("topic ")) {
			skip = false;
			continue;
		}
		skip = false;
		filtered.push(line);
	}

	fs.writeFileSync(ACL_FILE, filtered.join("\n"));
}

export function generateDeviceId(): string {
	return crypto.randomUUID();
}
