require('dotenv').config();

const express = require('express');
const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, Events } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

// =====================
// EXPRESS (IMPORTANTE PARA RAILWAY)
// =====================
const app = express();
const PORT = process.env.PORT || 3000;

// Ruta base (esto evita el 502)
app.get('/', (req, res) => {
    res.send("🚀 Lunaris Core activo");
});

// Iniciar servidor web
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web corriendo en puerto ${PORT}`);
});

// =====================
// DATABASE
// =====================
const db = new sqlite3.Database('./warns.db');

db.run(`CREATE TABLE IF NOT EXISTS warns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    userTag TEXT,
    reason TEXT,
    date TEXT
)`);

// =====================
// CLIENT DISCORD
// =====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// =====================
// READY
// =====================
client.once(Events.ClientReady, () => {
    console.log(`🤖 ${client.user.tag} online`);
});

// =====================
// COMMANDS
// =====================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(' ');
    const command = args[0];

    // CLEAR
    if (command === '!clear') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply('❌ No tienes permisos');
        }

        const amount = parseInt(args[1]);
        if (!amount) return message.reply('⚠️ Escribe un número');

        await message.channel.bulkDelete(amount, true);
        message.reply(`🧹 ${amount} mensajes eliminados`);
    }

    // WARN
    if (command === '!warn') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply('❌ Sin permisos');
        }

        const user = message.mentions.users.first();
        const reason = args.slice(2).join(' ') || "Sin razón";

        if (!user) return message.reply('⚠️ Menciona a alguien');

        db.run(
            `INSERT INTO warns (userId, userTag, reason, date) VALUES (?, ?, ?, ?)`,
            [user.id, user.tag, reason, new Date().toLocaleString()]
        );

        message.reply(`⚠️ ${user.tag} fue advertido`);
    }

    // VER WARNS
    if (command === '!warns') {
        const user = message.mentions.users.first();
        if (!user) return message.reply('⚠️ Menciona a alguien');

        db.all(`SELECT * FROM warns WHERE userId = ?`, [user.id], (err, rows) => {
            if (!rows || rows.length === 0) {
                return message.reply('✅ Sin warns');
            }

            let msg = `📋 Warns de ${user.tag}\n`;

            rows.forEach(w => {
                msg += `• ${w.reason} (${w.date})\n`;
            });

            message.channel.send(msg);
        });
    }

    // CLEAR WARNS
    if (command === '!clearwarns') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply('❌ Sin permisos');
        }

        const user = message.mentions.users.first();
        if (!user) return message.reply('⚠️ Menciona a alguien');

        db.run(`DELETE FROM warns WHERE userId = ?`, [user.id]);

        message.reply(`🧹 Warns eliminados`);
    }
});

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);

// =====================
// DASHBOARD
// =====================
require('./dashboard');