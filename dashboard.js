const express = require('express');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// DB
const db = new sqlite3.Database('./warns.db');

// HOME
app.get('/', (req, res) => {
    db.all("SELECT * FROM warns", [], (err, rows) => {

        let html = `
        <h1 style="color:purple;">Lunaris Dashboard</h1>
        <table border="1" style="color:white;">
        <tr>
            <th>ID</th>
            <th>User</th>
            <th>Reason</th>
            <th>Date</th>
        </tr>
        `;

        rows.forEach(w => {
            html += `
            <tr>
                <td>${w.id}</td>
                <td>${w.userTag}</td>
                <td>${w.reason}</td>
                <td>${w.date}</td>
            </tr>
            `;
        });

        html += "</table>";

        res.send(html);
    });
});

// SERVER
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Dashboard activo en puerto ${PORT}`);
});