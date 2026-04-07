require('dotenv').config();

const express = require('express');
const { Client, GatewayIntentBits, PermissionsBitField, Events, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

// =====================
// EXPRESS
// =====================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send("🚀 Lunaris Core activo");
});

// dashboard logs
app.get('/logs', (req, res) => {
    db.all("SELECT * FROM purchases ORDER BY id DESC LIMIT 20", [], (err, rows) => {
        res.json(rows);
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web activa`);
});

// =====================
// DATABASE
// =====================
const db = new sqlite3.Database('./data.db');

db.run(`CREATE TABLE IF NOT EXISTS economy (
    userId TEXT PRIMARY KEY,
    balance INTEGER
)`);

db.run(`CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    item TEXT,
    price INTEGER,
    date TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS warns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    userTag TEXT,
    reason TEXT,
    date TEXT
)`);

// =====================
// CONFIG LOGS
// =====================
const LOGS = {
    messages: "1480726976984518839",
    roles: "1480726976984518839",
    general: "1480726976984518839"
};

// =====================
// COOLDOWNS
// =====================
const cooldowns = {
    work: new Map(),
    daily: new Map()
};

// =====================
// FUNCTIONS
// =====================
function getUser(userId, callback) {
    db.get(`SELECT * FROM economy WHERE userId = ?`, [userId], (err, row) => {
        if (!row) {
            db.run(`INSERT INTO economy (userId, balance) VALUES (?, ?)`, [userId, 0]);
            return callback({ userId, balance: 0 });
        }
        callback(row);
    });
}

function updateBalance(userId, amount) {
    db.run(`UPDATE economy SET balance = balance + ? WHERE userId = ?`, [amount, userId]);
}

// =====================
// CLIENT
// =====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
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
// AUTO ROLE + WELCOME
// =====================
client.on(Events.GuildMemberAdd, async (member) => {
    const roleId = "1480379455271600360";
    const welcomeChannelId = "1480384374611378176";

    const welcomeChannel = await member.guild.channels.fetch(welcomeChannelId);
    const logChannel = await member.guild.channels.fetch(LOGS.general);

    await member.roles.add(roleId);

    // bienvenida
    welcomeChannel.send({
        embeds: [
            new EmbedBuilder()
                .setTitle("🌙 Bienvenido a Lunaris")
                .setDescription(`✨ Bienvenido ${member} a **${member.guild.name}**`)
                .setColor("#9b59b6")
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp()
        ]
    });

    // log
    logChannel.send({
        embeds: [
            new EmbedBuilder()
                .setTitle("📥 Nuevo miembro")
                .setColor("#00ffcc")
                .addFields(
                    { name: "Usuario", value: member.user.tag },
                    { name: "ID", value: member.user.id }
                )
                .setTimestamp()
        ]
    });
});

// =====================
// LOG: MENSAJE ELIMINADO
// =====================
client.on(Events.MessageDelete, async (message) => {
    if (!message.guild || message.author?.bot) return;

    const logChannel = await message.guild.channels.fetch(LOGS.messages);

    let executor = "Desconocido";

    try {
        const logs = await message.guild.fetchAuditLogs({ limit: 1, type: 72 });
        const entry = logs.entries.first();
        if (entry) executor = entry.executor.tag;
    } catch {}

    logChannel.send({
        embeds: [
            new EmbedBuilder()
                .setTitle("🗑️ Mensaje eliminado")
                .setColor("#e74c3c")
                .addFields(
                    { name: "Autor", value: message.author.tag },
                    { name: "Eliminado por", value: executor },
                    { name: "Canal", value: `${message.channel}` },
                    { name: "Contenido", value: message.content || "Sin texto" }
                )
                .setTimestamp()
        ]
    });
});

// =====================
// LOG: MENSAJE EDITADO
// =====================
client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
    if (!oldMsg.guild || oldMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content) return;

    const logChannel = await oldMsg.guild.channels.fetch(LOGS.messages);

    logChannel.send({
        embeds: [
            new EmbedBuilder()
                .setTitle("✏️ Mensaje editado")
                .setColor("#f1c40f")
                .addFields(
                    { name: "Usuario", value: oldMsg.author.tag },
                    { name: "Antes", value: oldMsg.content || "Vacío" },
                    { name: "Después", value: newMsg.content || "Vacío" }
                )
                .setTimestamp()
        ]
    });
});

// =====================
// LOG: ROLES
// =====================
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    const logChannel = await newMember.guild.channels.fetch(LOGS.roles);

    const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removed = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

    added.forEach(role => {
        logChannel.send(`➕ ${newMember.user.tag} recibió ${role.name}`);
    });

    removed.forEach(role => {
        logChannel.send(`➖ ${newMember.user.tag} perdió ${role.name}`);
    });
});

// =====================
// COMMANDS
// =====================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(' ');
    const command = args[0];

    const logChannel = await message.client.channels.fetch(LOGS.general);

    // BALANCE
    if (command === '!balance') {
        getUser(message.author.id, (data) => {
            message.reply(`💰 ${data.balance} monedas`);
        });
    }

    // WORK 20 MIN
    if (command === '!work') {
        const userId = message.author.id;
        const now = Date.now();
        const cooldown = 20 * 60 * 1000;

        if (cooldowns.work.has(userId)) {
            const expiration = cooldowns.work.get(userId) + cooldown;
            if (now < expiration) {
                const timeLeft = ((expiration - now) / 1000 / 60).toFixed(1);
                return message.reply(`⏳ Espera ${timeLeft} minutos`);
            }
        }

        cooldowns.work.set(userId, now);

        const amount = Math.floor(Math.random() * 100) + 50;

        getUser(userId, () => updateBalance(userId, amount));

        message.reply(`💼 Ganaste ${amount}`);
    }

    // DAILY
    if (command === '!daily') {
        const amount = 200;
        getUser(message.author.id, () => updateBalance(message.author.id, amount));
        message.reply(`🎁 Daily: ${amount}`);
    }

    // SHOP
    if (command === '!shop') {
        message.reply("🛒 VRChat Plus — 5000 monedas");
    }

    // BUY
    if (command === '!buy') {
        const price = 5000;

        getUser(message.author.id, (data) => {
            if (data.balance < price) return message.reply("❌ No tienes dinero");

            updateBalance(message.author.id, -price);

            message.reply("🛒 Compraste VRChat Plus");

            logChannel.send(`🛒 ${message.author.tag} compró VRChat Plus`);
        });
    }

    // WARN AUTO
    if (command === '!warn') {
        const member = message.mentions.members.first();
        if (!member) return message.reply("⚠️ menciona a alguien");

        db.run(
            `INSERT INTO warns (userId, userTag, reason, date) VALUES (?, ?, ?, ?)`,
            [member.id, member.user.tag, "Warn", new Date().toLocaleString()]
        );

        db.all(`SELECT * FROM warns WHERE userId = ?`, [member.id], async (err, rows) => {
            const total = rows.length;

            message.reply(`⚠️ ${member.user.tag} tiene ${total} warns`);

            if (total === 3) {
                await member.timeout(600000);
                message.channel.send("🔇 Mute automático");
            }

            if (total >= 10) {
                await member.ban();
                db.run(`DELETE FROM warns WHERE userId = ?`, [member.id]);
                message.channel.send("🔨 Ban automático");
            }
        });
    }

    // CLEAR
    if (command === '!clear') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

        const amount = parseInt(args[1]);
        await message.channel.bulkDelete(amount, true);

        logChannel.send(`🧹 ${amount} mensajes borrados`);
    }
});

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);