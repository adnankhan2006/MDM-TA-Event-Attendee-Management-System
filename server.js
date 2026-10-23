const express = require("express");
const path = require("path");
const db = require("./database");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validEvent(name, date, venue) {
    return (
        typeof name === "string" && name.trim() &&
        typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        !Number.isNaN(Date.parse(date)) &&
        new Date(date).toISOString().slice(0, 10) === date &&
        typeof venue === "string" && venue.trim()
    );
}

function validAttendee(name, email, ticketType) {
    return (
        typeof name === "string" && name.trim() &&
        typeof email === "string" && validEmail(email.trim()) &&
        typeof ticketType === "string" && ticketType.trim()
    );
}

function databaseError(res, err) {
    console.error(err.message);
    return res.status(500).json({ error: "A database error occurred." });
}

// Dashboard statistics
app.get("/api/stats", (req, res) => {
    db.get(
        `SELECT
            (SELECT COUNT(*) FROM events) AS totalEvents,
            (SELECT COUNT(*) FROM attendees) AS totalAttendees`,
        (err, row) => {
            if (err) return databaseError(res, err);
            res.json(row);
        }
    );
});

// GET all events, including attendee counts
app.get("/api/events", (req, res) => {
    const search = String(req.query.search || "").trim();

    db.all(
        `SELECT e.*, COUNT(a.id) AS attendee_count
         FROM events e
         LEFT JOIN attendees a ON a.event_id = e.id
         WHERE e.name LIKE ? OR e.venue LIKE ?
         GROUP BY e.id
         ORDER BY e.date ASC, e.id DESC`,
        [`%${search}%`, `%${search}%`],
        (err, rows) => {
            if (err) return databaseError(res, err);
            res.json(rows);
        }
    );
});

// CREATE event
app.post("/api/events", (req, res) => {
    const { name, date, venue, description = "" } = req.body;

    if (!validEvent(name, date, venue)) {
        return res.status(400).json({
            error: "Enter a valid event name, date and venue."
        });
    }

    if (typeof description !== "string") {
        return res.status(400).json({ error: "Invalid description." });
    }

    db.run(
        `INSERT INTO events (name, date, venue, description)
         VALUES (?, ?, ?, ?)`,
        [name.trim(), date, venue.trim(), description.trim()],
        function (err) {
            if (err) return databaseError(res, err);

            res.status(201).json({
                message: "Event created successfully.",
                id: this.lastID
            });
        }
    );
});

// UPDATE event
app.put("/api/events/:id", (req, res) => {
    const { name, date, venue, description = "" } = req.body;

    if (!validEvent(name, date, venue)) {
        return res.status(400).json({ error: "Invalid event details." });
    }

    if (typeof description !== "string") {
        return res.status(400).json({ error: "Invalid description." });
    }

    db.run(
        `UPDATE events
         SET name = ?, date = ?, venue = ?, description = ?
         WHERE id = ?`,
        [name.trim(), date, venue.trim(), description.trim(), req.params.id],
        function (err) {
            if (err) return databaseError(res, err);
            if (!this.changes) {
                return res.status(404).json({ error: "Event not found." });
            }

            res.json({ message: "Event updated successfully." });
        }
    );
});

// DELETE event (its attendees are deleted by the foreign-key cascade)
app.delete("/api/events/:id", (req, res) => {
    db.run(
        "DELETE FROM events WHERE id = ?",
        [req.params.id],
        function (err) {
            if (err) return databaseError(res, err);
            if (!this.changes) {
                return res.status(404).json({ error: "Event not found." });
            }

            res.json({ message: "Event and its registrations deleted." });
        }
    );
});

// GET attendees, optionally filtered by name, email or event
app.get("/api/attendees", (req, res) => {
    const search = String(req.query.search || "").trim();

    db.all(
        `SELECT a.*, e.name AS event_name, e.date AS event_date
         FROM attendees a
         JOIN events e ON e.id = a.event_id
         WHERE a.name LIKE ?
            OR a.email LIKE ?
            OR e.name LIKE ?
         ORDER BY a.id DESC`,
        [`%${search}%`, `%${search}%`, `%${search}%`],
        (err, rows) => {
            if (err) return databaseError(res, err);
            res.json(rows);
        }
    );
});

// REGISTER attendee
app.post("/api/attendees", (req, res) => {
    const { event_id, name, email, ticket_type } = req.body;
    const eventId = Number(event_id);

    if (!Number.isInteger(eventId) || eventId <= 0 ||
        !validAttendee(name, email, ticket_type)) {
        return res.status(400).json({
            error: "Provide a valid event, name, email and ticket type."
        });
    }

    db.run(
        `INSERT INTO attendees (event_id, name, email, ticket_type)
         VALUES (?, ?, ?, ?)`,
        [eventId, name.trim(), email.trim().toLowerCase(), ticket_type.trim()],
        function (err) {
            if (err && err.message.includes("UNIQUE constraint failed")) {
                return res.status(409).json({
                    error: "This email is already registered for that event."
                });
            }

            if (err && err.message.includes("FOREIGN KEY constraint failed")) {
                return res.status(400).json({ error: "Event does not exist." });
            }

            if (err) return databaseError(res, err);

            res.status(201).json({
                message: "Attendee registered successfully.",
                id: this.lastID
            });
        }
    );
});

// DELETE attendee registration
app.delete("/api/attendees/:id", (req, res) => {
    db.run(
        "DELETE FROM attendees WHERE id = ?",
        [req.params.id],
        function (err) {
            if (err) return databaseError(res, err);
            if (!this.changes) {
                return res.status(404).json({ error: "Registration not found." });
            }

            res.json({ message: "Registration deleted successfully." });
        }
    );
});

// Send API errors as JSON
app.use("/api", (req, res) => {
    res.status(404).json({ error: "API endpoint not found." });
});

// Serve the frontend for other browser routes
app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
    console.log(`Event Management System running at http://localhost:${PORT}`);
});