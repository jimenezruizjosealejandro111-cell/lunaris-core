require('dotenv').config();

console.log("🔥 LUNARIS GOD STABLE 🔥");

const express = require('express');
const { Client, GatewayIntentBits, Events, PermissionsBitField, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./data.db');

// =====================
// 🌐 WEB (ESTABLE)
// =====================
app.get('/', (req, res) => {
    res.send("🌙 Lunaris Core Online");
});

app.get('/panel', (req, res) => {
    db.all("SELECT * FROM levels ORDER BY level DESC", [], (err, rows) => {

        if (err) return res.send("DB ERROR");

        let html = "<h1>🏆 Ranking XP</h1>";

        rows.forEach((u, i) => {
            html += `<p>#${i+1} ${u.userId} - Nivel ${u.level}</p>`;
        });

        res.send(html);
    });
});

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

    const welcome = member.guild.channels.cache.find(c => c.name.includes("bienvenida"));
    const logs = getLogs(member.guild);

    const embed = new EmbedBuilder()
        .setColor("#a855f7")
        .setTitle("🌙 Bienvenido a Lunaris")
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setDescription(`💜 ${member} ha llegado\n🚀 Disfruta la comunidad`)
        .setFooter({ text: member.user.tag })
        .setTimestamp();

    welcome?.send({ embeds: [embed] });
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

    if (cmd === "!balance") {
        db.get(`SELECT * FROM economy WHERE userId=?`, [message.author.id], (err, row) => {
            message.reply(`💰 ${row?.balance || 0}`);
        });
    }

    if (cmd === "!work") {
        const money = Math.floor(Math.random() * 100) + 50;

        db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`, [money, message.author.id]);

        message.reply(`💼 Ganaste ${money}`);
    }

    if (cmd === "!give") {
        const user = message.mentions.users.first();
        const amount = parseInt(args[2]);

        if (!user || !amount) return message.reply("❌ Uso: !give @user cantidad");

        db.run(`UPDATE economy SET balance = balance - ? WHERE userId=?`, [amount, message.author.id]);
        db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`, [amount, user.id]);

        message.reply("💸 Transferido");
    }

    if (cmd === "!level") {
        db.get(`SELECT * FROM levels WHERE userId=?`, [message.author.id], (err, row) => {
            message.reply(`Nivel ${row?.level || 1}`);
        });
    }

    // =====================
    // 🛠️ SETUP FULL
    // =====================
    if (cmd === "!setup" && args[1] === "lunaris") {

        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        const guild = message.guild;

        await message.reply("🚀 Creando Lunaris FULL...");

        // BORRAR CANALES
        for (const ch of guild.channels.cache.values()) {
            try { await ch.delete(); } catch {}
        }

        // BORRAR ROLES
        for (const role of guild.roles.cache.values()) {
            if (role.name === "@everyone") continue;
            if (role.managed) continue;
            try { await role.delete(); } catch {}
        }

        // ROLES
        const owner = await guild.roles.create({ name: "🌙 Owner", permissions: ["Administrator"] });
        const admin = await guild.roles.create({ name: "💎 Admin" });
        const mod = await guild.roles.create({ name: "🔥 Mod" });
        const vip = await guild.roles.create({ name: "✨ VIP" });
        const member = await guild.roles.create({ name: "👤 Miembro" });

        // CATEGORÍAS
        const info = await guild.channels.create({ name: "📌 INFORMACIÓN", type: 4 });
        const general = await guild.channels.create({ name: "💬 GENERAL", type: 4 });
        const media = await guild.channels.create({ name: "📸 MEDIA", type: 4 });
        const games = await guild.channels.create({ name: "🎮 JUEGOS", type: 4 });
        const voice = await guild.channels.create({ name: "🔊 VOZ", type: 4 });
        const staff = await guild.channels.create({ name: "🛠️ STAFF", type: 4 });

        // INFO
        await guild.channels.create({ name: "👋・bienvenida", type: 0, parent: info.id });
        await guild.channels.create({ name: "📜・reglas", type: 0, parent: info.id });
        await guild.channels.create({ name: "📢・anuncios", type: 0, parent: info.id });

        // GENERAL
        await guild.channels.create({ name: "💭・general", type: 0, parent: general.id });
        await guild.channels.create({ name: "💰・economia", type: 0, parent: general.id });
        await guild.channels.create({ name: "😂・memes", type: 0, parent: general.id });
        await guild.channels.create({ name: "🎉・eventos", type: 0, parent: general.id });

        // MEDIA
        await guild.channels.create({ name: "📷・fotos", type: 0, parent: media.id });
        await guild.channels.create({ name: "🎥・clips", type: 0, parent: media.id });
        await guild.channels.create({ name: "🎨・arte", type: 0, parent: media.id });

        // JUEGOS
        await guild.channels.create({ name: "🔫・valorant", type: 0, parent: games.id });
        await guild.channels.create({ name: "💎・minecraft", type: 0, parent: games.id });
        await guild.channels.create({ name: "🌌・vrchat", type: 0, parent: games.id });

        // VOZ
        await guild.channels.create({ name: "🔊・General", type: 2, parent: voice.id });
        await guild.channels.create({ name: "🎮・Gaming", type: 2, parent: voice.id });

        // STAFF
        await guild.channels.create({
            name: "📊・staff-logs",
            type: 0,
            parent: staff.id,
            permissionOverwrites: [
                { id: guild.roles.everyone, deny: ["ViewChannel"] },
                { id: admin.id, allow: ["ViewChannel"] },
                { id: mod.id, allow: ["ViewChannel"] }
            ]
        });

        await guild.channels.create({
            name: "🧾・staff-chat",
            type: 0,
            parent: staff.id,
            permissionOverwrites: [
                { id: guild.roles.everyone, deny: ["ViewChannel"] },
                { id: admin.id, allow: ["ViewChannel"] },
                { id: mod.id, allow: ["ViewChannel"] }
            ]
        });

        await message.member.roles.add(owner);

        message.channel.send("🔥 Lunaris FULL PRO listo");
    }
});

client.login(process.env.TOKEN);