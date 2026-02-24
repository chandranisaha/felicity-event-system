const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const eventRoutes = require("./routes/eventRoutes");
const forumRoutes = require("./routes/forumRoutes");
const participantRoutes = require("./routes/participantRoutes");
const organizerRoutes = require("./routes/organizerRoutes");
const { joinForumRoom } = require("./controllers/forumController");

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
});
app.set("io", io);

connectDB();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.get("/", (req, res) => {
  res.send("api running");
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/events", forumRoutes);
app.use("/api/participants", participantRoutes);
app.use("/api/organizers", organizerRoutes);

io.on("connection", (socket) => {
  joinForumRoom(socket);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});
