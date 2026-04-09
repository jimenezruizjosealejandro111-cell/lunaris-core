require('dotenv').config();

console.log("🔥 LUNARIS GOD SYSTEM PRO+ 🔥");

const express = require('express');
const { Client, GatewayIntentBits, Events, PermissionsBitField, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./data.db');

// =====================
// 🌐 WEB PANEL
// =====================
app.get('/', (req, res) => {
    res.send(`<h1>🌙 Lunaris Dashboard</h1><a href="/panel">Ranking</a>`);
});

app.get('/panel', async (req, res) => {
    db.all("SELECT * FROM levels ORDER BY level DESC", [], async (err, rows) => {

        let html = `<h1>🏆 Ranking XP</h1>`;
        let pos = 1;

        for (const u of rows) {
            try {
                const user = await client.users.fetch(u.userId);
                html += `<p>#${pos} ${user.username} - Nivel ${u.level}</p>`;
            } catch {}
            pos++;
        }

        res.send(html);
    });
});

app.listen(process.env.PORT || 3000, '0.0.0.0');

// =====================
// DB
// =====================
db.run(`CREATE TABLE IF NOT EXISTS economy (userId TEXT PRIMARY KEY, balance INTEGER)`);
db.run(`CREATE TABLE IF NOT EXISTS levels (userId TEXT PRIMARY KEY, xp INTEGER, level INTEGER)`);

// =====================
// BOT
// =====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

// =====================
// HELPERS
// =====================
function getLogs(guild) {
    return guild.channels.cache.find(c => c.name.includes("staff-logs"));
}

// =====================
// READY
// =====================
client.once(Events.ClientReady, () => {
    console.log(`🤖 ${client.user.tag} ONLINE`);
});

// =====================
// 👋 BIENVENIDA PRO + AUTOROL + LOG
// =====================
client.on(Events.GuildMemberAdd, async (member) => {

    const role = member.guild.roles.cache.find(r => r.name.includes("Miembro"));
    if (role) member.roles.add(role).catch(()=>{});

    const welcome = member.guild.channels.cache.find(c => c.name.includes("bienvenida"));
    const logs = getLogs(member.guild);

    const embed = new EmbedBuilder()
        .setColor("#a855f7")
        .setTitle("🌙 Bienvenido a Lunaris")
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setDescription(
            `💜 ${member} ha llegado\n\n` +
            `✨ Sistema de niveles activo\n` +
            `💰 Gana monedas usando comandos\n\n` +
            `🚀 Disfruta la comunidad`
        )
        .setImage("https://i.imgur.com/7bK0nQK.png") // banner opcional
        .setFooter({ text: `Usuario: ${member.user.tag}` })
        .setTimestamp();

    welcome?.send({ embeds: [embed] });

    const logEmbed = new EmbedBuilder()
        .setColor("#2ecc71")
        .setTitle("📥 Usuario entró")
        .setDescription(`${member.user.tag}`)
        .setTimestamp();

    logs?.send({ embeds: [logEmbed] });
});

// =====================
// 🚪 SALIDA LOG
// =====================
client.on(Events.GuildMemberRemove, (member) => {

    const logs = getLogs(member.guild);

    const embed = new EmbedBuilder()
        .setColor("#e74c3c")
        .setTitle("📤 Usuario salió")
        .setDescription(member.user.tag)
        .setTimestamp();

    logs?.send({ embeds: [embed] });
});

// =====================
// ⚡ XP + NIVEL VISUAL PRO
// =====================
client.on(Events.MessageCreate, (message) => {
    if (message.author.bot) return;

    db.run(`INSERT OR IGNORE INTO levels VALUES (?,?,?)`, [message.author.id, 0, 1]);

    const xpGain = Math.floor(Math.random() * 10) + 5;

    db.get(`SELECT * FROM levels WHERE userId=?`, [message.author.id], (err, row) => {

        let xp = (row?.xp || 0) + xpGain;
        let level = row?.level || 1;

        if (xp >= level * 100) {
            xp = 0;
            level++;

            const embed = new EmbedBuilder()
                .setColor("#f1c40f")
                .setTitle("🎉 LEVEL UP")
                .setThumbnail(message.author.displayAvatarURL())
                .setDescription(
                    `🚀 ${message.author}\n\n` +
                    `Subiste a nivel **${level}**`
                )
                .setFooter({ text: "Lunaris XP System" });

            message.channel.send({ embeds: [embed] });
        }

        db.run(`INSERT OR REPLACE INTO levels VALUES (?,?,?)`, [message.author.id, xp, level]);
    });
});

// =====================
// 💬 COMANDOS
// =====================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(" ");
    const cmd = args[0];

    if (cmd === "!level") {
        db.get(`SELECT * FROM levels WHERE userId=?`, [message.author.id], (err, row) => {

            const embed = new EmbedBuilder()
                .setColor("#3498db")
                .setTitle("📊 Tu Nivel")
                .setDescription(
                    `Nivel: ${row?.level || 1}\nXP: ${row?.xp || 0}`
                );

            message.reply({ embeds: [embed] });
        });
    }

    // =====================
    // 🛠️ SETUP COMPLETO
    // =====================
    if (cmd === "!setup" && args[1] === "lunaris") {

        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        const guild = message.guild;

        for (const ch of guild.channels.cache.values()) {
            try { await ch.delete(); } catch {}
        }

        const owner = await guild.roles.create({ name: "🌙 Owner", permissions: ["Administrator"] });
        const admin = await guild.roles.create({ name: "💎 Admin" });
        const mod = await guild.roles.create({ name: "🔥 Mod" });
        const member = await guild.roles.create({ name: "👤 Miembro" });

        const info = await guild.channels.create({ name: "📌 INFORMACIÓN", type: 4 });
        const general = await guild.channels.create({ name: "💬 GENERAL", type: 4 });
        const media = await guild.channels.create({ name: "📸 MEDIA", type: 4 });
        const games = await guild.channels.create({ name: "🎮 JUEGOS", type: 4 });
        const staff = await guild.channels.create({ name: "🛠️ STAFF", type: 4 });

        await guild.channels.create({ name: "👋・bienvenida", type: 0, parent: info.id });
        await guild.channels.create({ name: "💭・general", type: 0, parent: general.id });
        await guild.channels.create({ name: "📊・staff-logs", type: 0, parent: staff.id });

        await message.member.roles.add(owner);

        message.channel.send("🔥 Lunaris listo PRO+");
    }
});

client.login(process.env.TOKEN);