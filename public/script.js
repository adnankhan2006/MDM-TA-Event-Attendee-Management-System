const $ = (id) => document.getElementById(id);

const eventForm = $("eventForm");
const attendeeForm = $("attendeeForm");

let toastTimer;

async function api(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}

function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function showToast(message) {
    $("toast").textContent = message;
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        $("toast").classList.remove("show");
    }, 3000);
}

function formatDate(date) {
    if (!date) return "—";
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

async function loadStats() {
    const stats = await api("/api/stats");
    $("totalEvents").textContent = stats.totalEvents;
    $("totalAttendees").textContent = stats.totalAttendees;
}

async function loadEvents() {
    const search = $("eventSearch").value.trim();
    const events = await api(`/api/events?search=${encodeURIComponent(search)}`);

    $("eventList").innerHTML = events.length
        ? events.map(event => `
            <article class="event-card">
                <span class="event-date">${escapeHtml(formatDate(event.date))}</span>
                <h3>${escapeHtml(event.name)}</h3>
                <p>📍 ${escapeHtml(event.venue)}</p>
                <p>${escapeHtml(event.description || "No description provided.")}</p>
                <p>👥 ${event.attendee_count} attendee(s)</p>
                <div class="event-actions">
                    <button class="btn primary small-btn" data-action="register"
                        data-id="${event.id}">Register</button>
                    <button class="btn secondary small-btn" data-action="edit"
                        data-id="${event.id}">Edit</button>
                    <button class="btn danger small-btn" data-action="delete-event"
                        data-id="${event.id}">Delete</button>
                </div>
            </article>
        `).join("")
        : `<p class="muted">No events found. Create your first event above!</p>`;

    const allEvents = await api("/api/events");
    const select = $("attendeeEvent");
    const previous = select.value;

    select.innerHTML = `<option value="">Choose an event</option>` +
        allEvents.map(event => `
            <option value="${event.id}">
                ${escapeHtml(event.name)} — ${escapeHtml(formatDate(event.date))}
            </option>
        `).join("");

    if (allEvents.some(event => String(event.id) === previous)) {
        select.value = previous;
    }

    return allEvents;
}

async function loadAttendees() {
    const search = $("attendeeSearch").value.trim();
    const attendees = await api(
        `/api/attendees?search=${encodeURIComponent(search)}`
    );

    $("attendeeTable").innerHTML = attendees.length
        ? attendees.map(person => `
            <tr>
                <td>${escapeHtml(person.name)}</td>
                <td>${escapeHtml(person.email)}</td>
                <td>${escapeHtml(person.event_name)}</td>
                <td>${escapeHtml(formatDate(person.event_date))}</td>
                <td>${escapeHtml(person.ticket_type)}</td>
                <td>
                    <button class="btn danger small-btn"
                        data-action="delete-attendee"
                        data-id="${person.id}">Remove</button>
                </td>
            </tr>
        `).join("")
        : `<tr><td colspan="6" class="muted">No registrations found.</td></tr>`;
}

async function refreshAll() {
    await loadStats();
    await loadEvents();
    await loadAttendees();
}

function resetEventForm() {
    eventForm.reset();
    $("eventId").value = "";
    $("eventFormTitle").textContent = "Create an Event";
    $("saveEventButton").textContent = "+ Create Event";
    $("cancelEdit").classList.add("hidden");
}

eventForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const id = $("eventId").value;
    const payload = {
        name: $("eventName").value.trim(),
        date: $("eventDate").value,
        venue: $("eventVenue").value.trim(),
        description: $("eventDescription").value.trim()
    };

    try {
        await api(id ? `/api/events/${id}` : "/api/events", {
            method: id ? "PUT" : "POST",
            body: JSON.stringify(payload)
        });

        showToast(id ? "Event updated successfully!" : "Event created!");
        resetEventForm();
        await refreshAll();
    } catch (error) {
        showToast(error.message);
    }
});

attendeeForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
        event_id: $("attendeeEvent").value,
        name: $("attendeeName").value.trim(),
        email: $("attendeeEmail").value.trim(),
        ticket_type: $("ticketType").value
    };

    try {
        await api("/api/attendees", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        showToast("Attendee registered successfully!");
        attendeeForm.reset();
        await refreshAll();
    } catch (error) {
        showToast(error.message);
    }
});

$("eventList").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;

    try {
        if (action === "register") {
            $("attendeeEvent").value = id;
            $("attendeeName").focus();
            $("attendeeForm").scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
            return;
        }

        if (action === "edit") {
            const events = await api("/api/events");
            const item = events.find(event => String(event.id) === id);
            if (!item) throw new Error("Event not found.");

            $("eventId").value = item.id;
            $("eventName").value = item.name;
            $("eventDate").value = item.date;
            $("eventVenue").value = item.venue;
            $("eventDescription").value = item.description || "";
            $("eventFormTitle").textContent = "Edit Event";
            $("saveEventButton").textContent = "Save Changes";
            $("cancelEdit").classList.remove("hidden");

            eventForm.scrollIntoView({ behavior: "smooth", block: "center" });
            $("eventName").focus();
            return;
        }

        if (action === "delete-event") {
            if (!confirm("Delete this event and all its attendee registrations?")) {
                return;
            }

            await api(`/api/events/${id}`, { method: "DELETE" });
            showToast("Event deleted.");
            await refreshAll();
        }
    } catch (error) {
        showToast(error.message);
    }
});

$("attendeeTable").addEventListener("click", async (event) => {
    const button = event.target.closest('button[data-action="delete-attendee"]');
    if (!button) return;

    if (!confirm("Remove this attendee registration?")) return;

    try {
        await api(`/api/attendees/${button.dataset.id}`, {
            method: "DELETE"
        });

        showToast("Registration removed.");
        await refreshAll();
    } catch (error) {
        showToast(error.message);
    }
});

$("cancelEdit").addEventListener("click", resetEventForm);

let eventSearchTimer;
$("eventSearch").addEventListener("input", () => {
    clearTimeout(eventSearchTimer);
    eventSearchTimer = setTimeout(() => {
        loadEvents().catch(error => showToast(error.message));
    }, 200);
});

let attendeeSearchTimer;
$("attendeeSearch").addEventListener("input", () => {
    clearTimeout(attendeeSearchTimer);
    attendeeSearchTimer = setTimeout(() => {
        loadAttendees().catch(error => showToast(error.message));
    }, 200);
});

refreshAll().catch(error => showToast(error.message));