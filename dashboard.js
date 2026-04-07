const express = require('express');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database('./warns.db');

app.get('/', (req, res) => {
    db.all("SELECT * FROM warns", [], (err, rows) => {

        let html = `
        <html>
        <head>
            <title>Lunaris Dashboard</title>
            <style>
                body { background: #0f0f1a; color: white; font-family: Arial; }
                table { width: 100%; border-collapse: collapse; }
                td, th { padding: 10px; border-bottom: 1px solid #333; }
                a { color: red; }
            </style>
        </head>
        <body>
            <h1>🌙 Lunaris Dashboard</h1>
            <table>
            <tr>
                <th>ID</th>
                <th>Usuario</th>
                <th>Razón</th>
                <th>Fecha</th>
                <th>Acción</th>
            </tr>
        `;

        rows.forEach(w => {
            html += `
            <tr>
                <td>${w.id}</td>
                <td>${w.userTag}</td>
                <td>${w.reason}</td>
                <td>${w.date}</td>
                <td><a href="/delete/${w.id}">Eliminar</a></td>
            </tr>
            `;
        });

        html += `</table></body></html>`;

        res.send(html);
    });
});

app.get('/delete/:id', (req, res) => {
    db.run("DELETE FROM warns WHERE id = ?", [req.params.id]);
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`🌐 Dashboard activo en puerto ${PORT}`);
});