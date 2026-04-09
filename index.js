require('dotenv').config();

console.log("🔥 LUNARIS GOD MODE FIX 🔥");

const express = require('express');
const { Client, GatewayIntentBits, Events, PermissionsBitField, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./data.db');

// =====================
// 🌐 WEB (FIX 503)
// =====================
app.get('/', (req, res) => {
    res.send("🌙 Lunaris Core Online");
});

app.get('/panel', (req, res) => {
    db.all("SELECT * FROM levels ORDER BY level DESC", [], (err, rows) => {

        if (err) return res.send("DB ERROR");

        let html = "<h1>🏆 Ranking</h1>";

        rows.forEach((u, i) => {
            html += `<p>#${i+1} ${u.userId} - Nivel ${u.level}</p>`;
        });

        res.send(html);
    });
});

// ⚠️ IMPORTANTE PARA RAILWAY
app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log("🌐 WEB ONLINE");
});

// =====================
// 🗄️ DATABASE
// =====================
db.run(`CREATE TABLE IF NOT EXISTS economy (userId TEXT PRIMARY KEY, balance INTEGER)`);
db.run(`CREATE TABLE IF NOT EXISTS levels (userId TEXT PRIMARY KEY, xp INTEGER, level INTEGER)`);

// =====================
// 🤖 BOT
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
// 👋 BIENVENIDA + AUTOROL
// =====================
client.on(Events.GuildMemberAdd, async (member) => {

    const role = member.guild.roles.cache.find(r => r.name === "👤 Miembro");
    if (role) await member.roles.add(role).catch(()=>{});

    const channel = member.guild.channels.cache.find(c => c.name.includes("bienvenida"));
    const logs = getLogs(member.guild);

    const embed = new EmbedBuilder()
        .setColor("#a855f7")
        .setTitle("🌙 Bienvenido a Lunaris")
        .setDescription(`💜 ${member} ha llegado`)
        .setThumbnail(member.user.displayAvatarURL());

    channel?.send({ embeds: [embed] });
    logs?.send(`📥 ${member.user.tag} entró`);
});

// =====================
// 🚪 SALIDA
// =====================
client.on(Events.GuildMemberRemove, (member) => {
    getLogs(member.guild)?.send(`📤 ${member.user.tag} salió`);
});

// =====================
// 🧠 AUTO REGISTRO
// =====================
client.on(Events.MessageCreate, (message) => {
    if (message.author.bot) return;

    db.run(`INSERT OR IGNORE INTO economy VALUES (?,?)`, [message.author.id, 0]);
    db.run(`INSERT OR IGNORE INTO levels VALUES (?,?,?)`, [message.author.id, 0, 1]);
});

// =====================
// ⚡ XP SYSTEM
// =====================
client.on(Events.MessageCreate, (message) => {
    if (message.author.bot) return;

    const xpGain = Math.floor(Math.random() * 10) + 5;

    db.get(`SELECT * FROM levels WHERE userId=?`, [message.author.id], (err, row) => {

        let xp = (row?.xp || 0) + xpGain;
        let level = row?.level || 1;

        if (xp >= level * 100) {
            xp = 0;
            level++;

            message.channel.send(`🎉 ${message.author} subió a nivel ${level}`);
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

    // 💰 BALANCE
    if (cmd === "!balance") {
        db.get(`SELECT * FROM economy WHERE userId=?`, [message.author.id], (err, row) => {
            message.reply(`💰 ${row?.balance || 0}`);
        });
    }

    // 💼 WORK
    if (cmd === "!work") {
        const money = Math.floor(Math.random() * 100) + 50;

        db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`, [money, message.author.id]);

        message.reply(`💼 Ganaste ${money}`);
    }

    // 💸 GIVE
    if (cmd === "!give") {
        const user = message.mentions.users.first();
        const amount = parseInt(args[2]);

        if (!user || !amount) return message.reply("❌ Uso: !give @user cantidad");

        db.run(`UPDATE economy SET balance = balance - ? WHERE userId=?`, [amount, message.author.id]);
        db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`, [amount, user.id]);

        message.reply("💸 Transferido");
    }

    // 📊 LEVEL
    if (cmd === "!level") {
        db.get(`SELECT * FROM levels WHERE userId=?`, [message.author.id], (err, row) => {
            message.reply(`Nivel ${row?.level || 1}`);
        });
    }

    // =====================
    // 🛠️ SETUP LIMPIO
    // =====================
    if (cmd === "!setup" && args[1] === "lunaris") {

        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        const guild = message.guild;

        for (const ch of guild.channels.cache.values()) {
            try { await ch.delete(); } catch {}
        }

        for (const role of guild.roles.cache.values()) {
            if (role.name === "@everyone") continue;
            if (role.managed) continue;
            try { await role.delete(); } catch {}
        }

        const owner = await guild.roles.create({ name: "🌙 Owner", permissions: ["Administrator"] });
        const member = await guild.roles.create({ name: "👤 Miembro" });

        const info = await guild.channels.create({ name: "📌 INFORMACIÓN", type: 4 });
        const general = await guild.channels.create({ name: "💬 GENERAL", type: 4 });
        const staff = await guild.channels.create({ name: "🛠️ STAFF", type: 4 });

        await guild.channels.create({ name: "👋・bienvenida", type: 0, parent: info.id });
        await guild.channels.create({ name: "💭・general", type: 0, parent: general.id });
        await guild.channels.create({ name: "📊・staff-logs", type: 0, parent: staff.id });

        await message.member.roles.add(owner);

        message.channel.send("🔥 Lunaris listo");
    }
});

client.login(process.env.TOKEN);