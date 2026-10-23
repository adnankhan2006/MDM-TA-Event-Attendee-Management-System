# Event & Attendee Management System

A full-stack web application for managing events and attendee registrations.

## Features

- Create, view, update and delete events
- Register and remove attendees
- Search events by name or venue
- Search attendees by name, email or event
- Prevent duplicate registrations for the same event
- Validate required fields and email addresses
- Dashboard statistics for events and registrations
- Persistent SQLite database storage
- REST API integration using Fetch API

## Technology Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js and Express.js
- Database: SQLite

## Installation

1. Install Node.js.
2. Clone this repository.
3. Open a terminal in the project directory.
4. Install dependencies:

   `npm install`

5. Start the application:

   `npm start`

6. Open http://localhost:3000 in your browser.

The SQLite database and tables are created automatically when the application starts.

## API Endpoints

### Events
- GET `/api/events`
- GET `/api/stats`
- POST `/api/events`
- PUT `/api/events/:id`
- DELETE `/api/events/:id`

### Attendees
- GET `/api/attendees`
- POST `/api/attendees`
- DELETE `/api/attendees/:id`

## Database Schema

**Events:** ID, name, date, venue, description.

**Attendees:** ID, event ID, name, email, ticket type.

One event can have multiple attendees. Each email can register only once per event.

## Project Purpose

This project demonstrates full-stack CRUD development, REST APIs, relational database design, input validation and frontend-backend integration.
