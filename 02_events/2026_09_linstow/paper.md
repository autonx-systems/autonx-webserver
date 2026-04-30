# Software-Defined Drone Defence: An Adaptive, OEM-Agnostic C2 Architecture for Interoperable Swarm Operations over 4G/5G

**Authors:** autonx systems GmbH (Berlin) · Flybionic GmbH (Berlin)  
**Venue:** DWT Conference "Innovationstreiber KI und Unbemannte Systeme", 21–23 September 2026, Linstow  
**Status:** Draft v0.1 — for internal review

---

## Abstract

NATO's eastern flank faces a rapidly escalating drone threat that current countermeasures — expensive missiles and jet fighters — cannot address at scale. The "drone wall" concept offers a strategic alternative: distributed interceptor depots along exposed borders, coordinated remotely via autonomous swarms. This paper argues that the drone wall is not primarily a hardware problem but a software and communication problem. Two interdependent capabilities are missing: reliable long-range cellular communication that operates today at scale without new infrastructure, and an adaptive, vendor-neutral Command and Control (C2) layer capable of orchestrating heterogeneous assets across dynamic missions with multiple stakeholders. We present a joint architecture combining Flybionic's software-optimized 4G/5G communication stack — built on years of Fraunhofer HHI research — with autonx's Mission-Adaptive Operator Interface platform. Together these form a fully OEM-agnostic, software-defined C2 stack. Both components exist as working prototypes today. We demonstrate the architecture through three concrete military training scenarios and discuss the path to operational deployment.

---

## 1. Introduction & Motivation

NATO's eastern flank is exposed to a drone threat that is accelerating in both scale and sophistication. Cheap, commercially available fixed-wing and multi-rotor platforms — costing as little as a few hundred euros — are being deployed in numbers that overwhelm traditional kinetic countermeasures. Intercepting a €500 drone with a €2,000,000 missile is neither cost-effective nor strategically sustainable when the attacker can field hundreds simultaneously.

The "drone wall" concept has emerged as a strategic response. Rather than relying on expensive point-defence systems, the concept places distributed depots of interceptor drones along exposed border regions. These depots can be activated and coordinated remotely, launching swarms of small interceptors that engage incoming threats in the engagement zone before they reach critical infrastructure or population centres. The concept is asymmetric in the right direction: the defending swarm can be built and operated at a fraction of the cost of the attacking swarm, while the infrastructure investment is similarly bounded.

What prevents the drone wall from existing today is not hardware. Drones capable of flying intercept missions already exist across multiple commercial OEM platforms. The barriers are twofold and interdependent:

**(a) Communication.** BVLOS (beyond-visual-line-of-sight) drone control over long distances requires a communication link that is reliable, scalable, low-latency, and available without purpose-built military infrastructure. 4G/5G cellular networks cover large portions of NATO's exposed flanks, yet they are widely dismissed for drone communications due to persistent misconceptions about the technology. As we argue in Section 2, these limitations are software problems — already solved — not network limitations.

**(b) Mission Management.** Even with reliable communication, orchestrating dozens or hundreds of heterogeneous vehicles across a rapidly evolving tactical picture requires a C2 layer that does not yet exist in accessible form. Current ground control stations are vendor-locked, single-operator, and rigidly structured — the opposite of what dynamic swarm operations demand. Section 3 develops the case for a Mission-Adaptive Operator Interface (MAOI) as the answer.

This paper presents a joint architecture addressing both challenges. **Flybionic GmbH** (Berlin) brings software-optimized 4G/5G communication developed over years of deep-tech research at Fraunhofer HHI. **autonx systems GmbH** (Berlin) contributes the adaptive C2 and mission management layer. Section 4 shows how the two components combine into a unified, fully OEM-agnostic C2 stack. Section 5 demonstrates the architecture through three military training scenarios, and Section 6 discusses open challenges and the path to operational deployment.

> **[Figure 1 — Two-layer concept overview]**  
> *Schematic showing the Flybionic transport layer (below) and the autonx orchestration layer (above), with heterogeneous drones on the left and multiple stakeholder roles on the right. Clean, no implementation detail — that comes in Fig. 4.*

---

## 2. The Communication Challenge

### 2.1 The State of BVLOS Drone Communication

Reliable beyond-visual-line-of-sight drone communication remains an unsolved operational problem for most users. Current approaches fall into three categories, each with significant constraints:

**Fire-and-forget.** The drone executes a pre-programmed mission with no mid-flight command capability. This is operationally adequate for fixed-route logistics but eliminates the adaptive retasking and real-time guidance that intercept missions require.

**Bespoke long-range radio.** Proprietary radio links (e.g., 900 MHz systems, custom UHF) offer direct control but are limited in range (typically 10–50 km line-of-sight), offer low bandwidth insufficient for video, and do not scale — each additional vehicle requires additional radio infrastructure.

**Satellite.** SATCOM addresses range limitations but introduces cost (hardware and per-minute usage), significant latency (typically 600–800 ms for geostationary links), and regulatory constraints. Real-time intercept guidance over SATCOM is not viable.

**Cellular (4G/5G).** Theoretically ideal: ubiquitous infrastructure, high bandwidth, low latency when configured correctly, and symmetric scalability (each additional drone costs one SIM card). In practice, widely dismissed due to reported unreliability. The root cause of that unreliability, however, is misunderstood.

### 2.2 The Misconception: A Software Problem, Not a Network Problem

The failures attributed to 4G/5G drone communication are not caused by the cellular network. They are caused by the way communication modems are integrated into airborne platforms. Specifically:

- **USB instability under vibration:** Standard USB connections — the default interface between onboard computers and cellular modems — fail under the vibration environment of multirotor and fixed-wing platforms. Signal interrupts are interpreted as device disconnects, breaking the cellular link.
- **Modem management software designed for ground use:** Standard Linux modem managers (ModemManager, NetworkManager) are designed for stationary or slow-moving ground applications. They handle handovers poorly and treat the frequent base-station switches experienced by fast-moving airborne platforms as failures rather than expected events.
- **Protocol brittleness:** Higher-layer protocols that cannot tolerate jitter and packet reordering degrade severely in cellular environments, even when the underlying link is healthy.

Flybionic GmbH, building on years of research at Fraunhofer Heinrich Hertz Institute (HHI), has solved all three problems at the software layer. Their work requires no modifications to existing cellular infrastructure — the network does not change. The fix is entirely on the airborne side: ruggedized modem integration, purpose-built connectivity management software, and protocol optimizations that treat the cellular channel correctly.

### 2.3 Structural Advantages for the Drone Wall

Software-optimized 4G/5G communication provides four structural advantages specifically relevant to a drone wall deployment:

1. **No new infrastructure.** Cellular coverage already exists along NATO's eastern border regions. The drone wall can be deployed immediately, at low cost, without waiting for purpose-built communication infrastructure to be planned, funded, and built.

2. **Inherent scalability.** Scaling the fleet from ten to one thousand interceptors requires one SIM per drone. There is no radio spectrum management problem, no frequency coordination with allied forces, and no hardware procurement bottleneck.

3. **Unlimited operational reach.** The operational radius is limited by the drone's battery, not its communication range. A drone flying at altitude sees multiple base stations simultaneously, providing redundant coverage that is unavailable to ground vehicles.

4. **Resilience through density.** Dense cellular coverage means that the loss of individual base stations — whether through attack, power failure, or terrain masking — does not break communication. A drone at operational altitude typically maintains signal to three or more cells simultaneously.

Military-specific concerns about cellular communication are addressed directly: attacking base station infrastructure at the scale required to disrupt a distributed drone wall operation is not tactically practical; on-board jammers are too low-powered to matter at guidance ranges; and cellular uplinks are significantly more robust than GNSS signals to electronic warfare.

A concrete proof point: Flybionic has demonstrated end-to-end drone communication over cellular from Germany to Malawi — 7,200 km — with 170 ms round-trip latency. A joint demonstration for the German armed forces is planned for 2026.

> **[Figure 2 — 4G/5G communication architecture]**  
> *Adapted from Flybionic whitepaper Fig. 3: drone → software-optimized 4G/5G modem → cellular network → encrypted IP tunnel → server infrastructure → operator stations. Simple, clean schematic.*

---

## 3. The Orchestration Challenge

### 3.1 Operational Reality of Drone Wall Missions

A drone wall intercept operation is not a routine BVLOS flight. It is a dynamic, multi-actor engagement with the following characteristics:

**Inherent dynamism.** Hostile drone trajectories are unpredictable and change in response to defender actions. Weather conditions shift mid-engagement. Individual vehicles fail. Rules of engagement evolve based on authorization status and engagement outcomes. A C2 system that cannot adapt in real time is operationally useless.

**Fleet heterogeneity.** A realistic drone wall deployment will draw on commercially available interceptor platforms from multiple OEMs — the most capable platform available today at low cost. These platforms speak different proprietary protocols, expose different telemetry formats, and have different flight characteristic models. A C2 system tied to any single OEM is a procurement constraint masquerading as a technical requirement.

**Multi-stakeholder complexity.** A swarm intercept operation involves multiple actors with different responsibilities and information needs: intercept controllers issuing guidance commands to individual vehicles, strategic command authorizing engagements and holding the operational picture, maintenance crews monitoring vehicle health, exercise or operations directors with oversight and scenario control. Each role requires different information presented differently, with different control authority.

### 3.2 Why Current Ground Control Stations Cannot Serve This

Today's ground control stations were designed for a different problem: one pilot, one vehicle, one manufacturer. They fail the drone wall operational context on every dimension:

- **Vendor lock-in.** Each OEM supplies its own GCS. Operating a mixed fleet means operating multiple incompatible systems simultaneously, with no shared operational picture.
- **Rigid interfaces.** GCS interfaces are fixed products with static views designed by engineers for a notional single-operator role. They cannot be reconfigured for different operational roles without developer intervention.
- **Single-user assumption.** Most GCS software is designed for one operator on one screen. Multi-user operation, shared pictures, and role-based access control are absent or primitive.
- **No adaptation without development.** When the mission changes — new vehicle type, new role, new data source — the interface requires a new development cycle.

### 3.3 The Mission-Adaptive Operator Interface

The Mission-Adaptive Operator Interface (MAOI) concept addresses these limitations by treating the C2 interface as a mission variable rather than a fixed product. Key principles:

**Composition over configuration.** Operators build their own C2 views from a shared library of widgets — map displays, telemetry panels, video feeds, command interfaces, timeline views — without developer involvement. View composition is a drag-and-drop operation.

**Runtime reconfigurability.** Views can be modified during operations as the mission evolves, not just at setup time. When a new asset type is added mid-mission, its widgets appear in the palette immediately.

**Role-based multi-stakeholder views.** Multiple operators work simultaneously from the same underlying data. The intercept controller sees vehicle telemetry and guidance tools; strategic command sees the operational picture and authorization interfaces; the exercise director sees everything plus scenario control. Same data, different presentations, same platform.

**OEM abstraction.** Vehicle-Specific Modules (VSMs) translate each OEM's proprietary protocol into a unified command and telemetry interface. Adding a new vehicle type means adding a new VSM — the rest of the C2 architecture is unchanged.

**Browser-native deployment.** Any device with a browser — laptop, tablet, wall display, VR headset — becomes an operator station. There is no software to install, no hardware to provision, no logistics tail.

**AI-native mission control.** Natural language commands are translated to geo-referenced waypoint missions across mixed fleets. An operator can issue "cover the northern approach corridor with three vehicles" and receive a mission plan for review and execution — without manually constructing individual waypoint sequences.

The autonx platform's adaptability under operational conditions is proven. During an eVTOL certification flight-test campaign, the same platform supported three distinct interface configurations across eight weeks: battery qualification testing in Week 1, sensor integration monitoring in Week 4, and full certification interface in Week 8. No platform rebuilding. No developer engagement between iterations. The interface adapted; the platform did not change.

> **[Figure 3 — Before/after comparison]**  
> *Left: fragmented status quo — multiple GCS windows per OEM, no shared picture, each showing different interface. Right: autonx approach — one platform, multiple role-based views drawing from the same data layer. Conceptual diagram, not a screenshot.*

---

## 4. Joint Architecture

### 4.1 Two-Layer Architecture

The joint architecture combines the two components into a unified system with clearly defined responsibilities and a clean interface between layers.

**Transport Layer (Flybionic)**

Each vehicle carries a Linux-based companion computer with a ruggedized 4G/5G modem, connected to a MAVLink-capable flight controller. Flybionic's software stack manages the cellular link with purpose-built connectivity management optimized for airborne use: jitter-tolerant protocol handling, seamless base-station handover, and vibration-resistant hardware integration.

The transport layer delivers a bidirectional, encrypted IP tunnel from each vehicle to central server infrastructure. Over this tunnel:
- **Uplink (C2):** Commands, trajectory updates, and parameter changes flow from the orchestration layer to the flight controller.
- **Downlink (telemetry/video):** MAVLink telemetry, RTSP video streams, and sensor feeds flow from the vehicle to the orchestration layer.

Encryption is AES-256. The transport layer is protocol-agnostic — it delivers IP packets reliably. What rides those packets is the orchestration layer's concern.

**Orchestration Layer (autonx)**

The autonx server receives data from the transport layer through VSMs. Each VSM handles a single OEM's protocol: it translates incoming proprietary telemetry into a normalized data model and translates outgoing normalized commands into OEM-specific control messages.

Above the VSM layer:
- A **real-time data bus** distributes normalized vehicle state to all connected operator stations via secure WebSocket.
- The **view composition engine** manages role-based operator interface configurations, maintaining each operator's current view and handling widget state synchronization.
- The **AI mission planning agent** processes natural language commands, generates geo-referenced mission plans for operator review, and provides real-time decision support.
- **Role-based access control** governs which operators can issue which commands to which vehicles.

**Browser-based operator stations** connect to the server via secure WebSocket. Each station renders the operator's configured view from the live data stream. Multiple operators work simultaneously with independent views.

### 4.2 System Integration

The integration between layers is straightforward because both are software-first and IP-based:

1. Flybionic's transport layer terminates at a server-side endpoint, delivering normalized IP traffic per vehicle.
2. autonx's VSMs subscribe to those endpoints, translating OEM-specific protocol to normalized state.
3. The orchestration layer treats each vehicle as a node in its data model — OEM identity is a VSM implementation detail, invisible to operators and the AI agent.

This architecture is fully OEM-agnostic at the orchestration level. Adding a new vehicle type requires one new VSM. Adding a new vehicle instance requires one SIM and one VSM configuration entry. Neither change requires infrastructure modification.

### 4.3 Interoperability

The architecture is designed for alignment with **STANAG 4586**, the NATO standard for UAV ground control stations. The VSM abstraction maps directly onto STANAG 4586's Vehicle Specific Module concept. Open APIs allow integration with external systems: UTM (unmanned traffic management), radar and sensor feeds, and allied C2 systems.

> **[Figure 4 — Full joint architecture diagram]**  
> *The "money figure." Left: heterogeneous drones (custom UAV via API, COTS UAV via USB/Ethernet, radio-linked UAV). Centre: Flybionic transport layer — 4G/5G modem → cellular network → AES-256 encrypted IP tunnel → server infrastructure. Right: autonx server — VSMs → AI agent → role-based access control → secure WebSocket → browser-based operator stations (Strategic Command view, Intercept Controller view, Exercise Director console). Annotated data flows: MAVLink C2 uplink, RTSP video downlink, secure WebSocket to operators. Clear, uncluttered.*

---

## 5. Training Use Cases

The joint architecture is designed not only for operational deployment but also for training — the period during which capability is built, tactics are developed, and personnel are qualified. Three use cases illustrate how the architecture supports military training today.

### Use Case 1: Swarm Intercept Exercise (Schwarmabwehr-Übung)

**Scenario.** Multiple interceptor drones from different OEMs are launched from dispersed positions to engage simulated hostile drones injected into the scenario by an exercise director. The exercise runs at company level, with intercept controllers, a command post, and performance analysts operating simultaneously from one platform.

**C2 view configuration.** Four role-based views are composed and deployed from the autonx platform:

- **Intercept Controller view:** Vehicle telemetry for assigned interceptors, threat track display, guidance command interface, link quality indicators from Flybionic's transport layer.
- **Strategic Command view:** Full operational picture, engagement status summary, engagement authorization interface, communication with intercept controllers.
- **Performance Analyst view:** Synchronized dual-track timeline — operator actions on the upper track, swarm behaviour metrics on the lower track, with connecting annotations showing cause-and-effect relationships between commands and outcomes. Intercept timing, coverage analysis, decision latency.
- **Exercise Director console:** God-mode visibility across all views, threat injection controls, scenario branching, trainee reaction-time metrics, and the ability to introduce fault conditions (link degradation, vehicle failure, sudden no-fly zone activation) mid-exercise.

**Key capability demonstrated.** One platform runs the entire exercise across heterogeneous vehicles with no separate training software. When the exercise scenario changes — new threat types, different engagement geometries, additional vehicle OEMs — the interfaces are updated via drag-and-drop. The platform does not change.

**Connection to the drone wall.** The Performance Analyst view provides the correlation that training effectiveness requires: not just "what happened" but "what operator action caused what swarm outcome, and how quickly." This feedback loop is essential for developing and validating intercept tactics before operational deployment.

> **[Figure 5 — Role-based C2 views for swarm intercept exercise]**  
> *Conceptual layout showing the four C2 views as overlapping panels. The Performance Analyst view features a simplified dual-track timeline: operator actions (top), drone behaviour (bottom), cause-and-effect annotations connecting the two tracks. Clean wireframe, not a screenshot.*

### Use Case 2: BVLOS Pilot Qualification (Fernführer-Qualifizierung)

**Scenario.** Drone operators are qualified for beyond-visual-line-of-sight operations over cellular connectivity. The curriculum is progressive: trainees advance through increasing levels of operational complexity, with the training interface adapting to each level.

**Platform configuration.** The instructor uses the autonx zero-code interface builder to create a tailored training station:

- **Trainee view** mirrors the operational interface the trainee will use, configured to their current qualification level (simplified telemetry with guided checklists at basic level, full operational interface at advanced level).
- **Instructor overlay** supplements the trainee view with Flybionic link-quality indicators (RSSI, handover frequency, latency histogram) and fault injection widgets: link degradation, GNSS denial, sudden airspace restriction activation.
- **AI copilot** is toggled per session — available for novice trainees, disabled for advanced qualification checks.

**Qualification records.** All trainee actions, decision points, and response times are logged automatically. Qualification documentation is generated from the log and exported in a format compatible with formal certification processes.

**Key capability demonstrated.** When the training curriculum evolves — new communication scenarios, new fault conditions, new qualification criteria — the instructor updates the interface in minutes via drag-and-drop. No developer engagement, no procurement cycle. The cost of curriculum iteration is an afternoon, not a contract.

### Use Case 3: Joint Multi-Domain Reconnaissance Exercise (Verbundübung Aufklärung)

**Scenario.** A combined exercise integrates aerial drones conducting surveillance, a ground-based radar station providing detection tracks, and a command post integrating the fused picture. Multiple units at geographically distributed locations — each accessing the shared operational picture via cellular connectivity from their own devices.

**Role-based view configuration:**

- **Drone operators:** Vehicle telemetry, camera feeds, mission progress, communication with the command post.
- **Intelligence analyst:** Detection overlays, classification confidence indicators, cross-cuing between drone video and radar tracks.
- **Commanding officer:** Fused operational picture, AI recommendation overlays for retasking based on new detections, engagement authority interface.
- **Exercise director:** Information-flow monitoring, sensor-to-decision chain timing metrics, scenario injection controls.

**Natural language retasking.** During the exercise, the commanding officer identifies a gap in surveillance coverage and issues the command: "Shift two vehicles to cover the north-eastern approach, prioritize the river crossing." The autonx AI agent translates this to geo-referenced waypoint missions for two designated vehicles, presents the plan for authorization, and executes on approval — without the commanding officer constructing individual waypoint sequences.

**Key capability demonstrated.** When a unit brings a different drone type to the next iteration of the exercise, a new VSM is added to the platform. The exercise setup — views, roles, scenario logic — carries over unchanged. The platform's OEM-agnosticism converts what would otherwise be a re-procurement and re-integration effort into a one-time VSM development task.

---

## 6. Discussion & Conclusion

### 6.1 Discussion

The architecture presented in this paper addresses the core technical barriers to drone wall deployment. We acknowledge several open challenges that require further work.

**Hardening for higher classification levels.** Commercial 4G/5G operates on public cellular infrastructure. For operations above a certain classification level, migration to PPDR (Public Protection and Disaster Relief) priority channels or dedicated military cellular spectrum will be required. The migration path is technically straightforward — the software stack is channel-agnostic — but regulatory and procurement processes take time. Initiating that process now, in parallel with capability development, is the practical recommendation.

**Latency in terminal-phase engagement.** The current architecture provides adequate latency for most intercept mission phases: search, acquisition, approach, and guidance. At close range, in the terminal phase, command latency becomes a constraint for precise manoeuvring. The mitigation is onboard autonomy: the vehicle's own sensors and processing take over at close range, with C2 providing mission parameters rather than continuous guidance. This is already the design assumption in the architecture.

**Certification and autonomous engagement authorization.** The technology is ready. The regulatory framework for authorizing autonomous engagement decisions is not. This is not a technical problem but a policy and legal one that requires engagement with the Bundeswehr's legal and oversight structures. The training use cases presented here operate in a fully human-in-the-loop configuration, which is the appropriate baseline for initial deployment.

**VSM coverage.** Practical drone wall deployment requires VSMs for the most common commercial interceptor platforms. The set of relevant OEMs is bounded and known. VSM development is iterative and parallel — the architecture does not require all VSMs before any capability can be fielded.

The planned 2026 joint demonstration for the German armed forces will address the most persistent misconception: that 4G/5G cellular communication is unsuitable for military drone operations. A live demonstration under realistic conditions, with measurement data, is more persuasive than any amount of argument.

The development philosophy for both components mirrors the conference's own framing: "fight tomorrow" and "fight next week." Start with the most common platforms and the most critical scenarios. Expand iteratively. Do not wait for a perfect specification before beginning.

### 6.2 Conclusion

The drone wall concept is viable today. The limiting factors are not hardware availability, not network coverage, and not a lack of capable platforms. The limiting factors are software and system integration — exactly the domain where both contributing organizations operate.

Flybionic's software-optimized 4G/5G communication stack, built on Fraunhofer HHI research, delivers reliable, scalable, low-cost communication to airborne platforms without modifications to existing infrastructure. autonx's Mission-Adaptive Operator Interface delivers an OEM-agnostic, role-adaptive C2 layer that can orchestrate heterogeneous swarms across dynamic missions with multiple stakeholders.

Both technologies exist as working prototypes today. Both are EU-sovereign: Berlin-based companies, with the communication technology rooted in publicly funded German research. Both are software-first and IP-based, making integration straightforward rather than a multi-year engineering programme.

Together, they form a software-defined foundation for drone defence that is realistic, buildable, and scalable. The infrastructure is already there. The software exists. What is needed now is the decision to start building.

---

## References

> *(To be populated in collaboration with Flybionic — will include Fraunhofer HHI publications, STANAG 4586, and relevant prior work on drone wall concepts.)*

---

*Draft v0.1 — autonx systems GmbH · April 2026*  
*For review and comment — not for external distribution*
