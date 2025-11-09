import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { db } from "./app/models";
import { registerViewRoutes } from "./app/routes/view.routes";

dotenv.config();

const app = express();

var corsOptions = {
	origin: "http://localhost:3000",
};

app.use(cors(corsOptions));

// parse requests of content-type - application/json
app.use(express.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

db.sequelize.sync();
// // drop the table if it already exists
// db.sequelize.sync({ force: true }).then(() => {
//   console.log("Drop and re-sync db.");
// });

// simple route
app.get("/", (req, res) => {
	res.json({ message: "Welcome to AutonX webserver." });
});

registerViewRoutes(app);

// set host & port, listen for requests
const HOST = process.env.NODE_DOCKER_HOST || '0.0.0.0';
const PORT = Number(process.env.NODE_DOCKER_PORT) || 8080;
app.listen(PORT, HOST, () => {
	console.log(`Server is running on port ${PORT}.`);
});
