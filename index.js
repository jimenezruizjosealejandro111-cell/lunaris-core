require('dotenv').config();

console.log("🔥 LUNARIS FINAL FIX 🔥");

const express = require('express');
const { Client, GatewayIntentBits, Events, PermissionsBitField, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./data.db');

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
// 👋 BIENVENIDA + AUTOROL + LOG
// =====================
client.on(Events.GuildMemberAdd, async (member) => {

    const role = member.guild.roles.cache.find(r => r.name === "👤 Miembro");

    if (role) {
        await member.roles.add(role).catch(() => {});
    }

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
// 🚪 SALIDA LOG
// =====================
client.on(Events.GuildMemberRemove, (member) => {
    const logs = getLogs(member.guild);
    logs?.send(`📤 ${member.user.tag} salió`);
});

// =====================
// 💬 COMANDOS
// =====================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(" ");
    const cmd = args[0];

    // =====================
    // 🛠️ SETUP LIMPIO TOTAL
    // =====================
    if (cmd === "!setup" && args[1] === "lunaris") {

        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        const guild = message.guild;

        await message.reply("⚠️ Reiniciando servidor completo...");

        // 🧹 BORRAR CANALES
        for (const ch of guild.channels.cache.values()) {
            try { await ch.delete(); } catch {}
        }

        // 🧹 BORRAR ROLES (excepto everyone y bot)
        for (const role of guild.roles.cache.values()) {
            if (role.name === "@everyone") continue;
            if (role.managed) continue; // bot roles
            try { await role.delete(); } catch {}
        }

        // =====================
        // 🎭 CREAR ROLES
        // =====================
        const owner = await guild.roles.create({
            name: "🌙 Owner",
            permissions: ["Administrator"]
        });

        const admin = await guild.roles.create({ name: "💎 Admin" });
        const mod = await guild.roles.create({ name: "🔥 Mod" });
        const member = await guild.roles.create({ name: "👤 Miembro" });

        // =====================
        // 📂 CATEGORÍAS
        // =====================
        const info = await guild.channels.create({ name: "📌 INFORMACIÓN", type: 4 });
        const general = await guild.channels.create({ name: "💬 GENERAL", type: 4 });
        const media = await guild.channels.create({ name: "📸 MEDIA", type: 4 });
        const games = await guild.channels.create({ name: "🎮 JUEGOS", type: 4 });
        const voice = await guild.channels.create({ name: "🔊 VOZ", type: 4 });
        const staff = await guild.channels.create({ name: "🛠️ STAFF", type: 4 });

        // =====================
        // 📌 INFO
        // =====================
        await guild.channels.create({ name: "👋・bienvenida", type: 0, parent: info.id });
        await guild.channels.create({ name: "📜・reglas", type: 0, parent: info.id });
        await guild.channels.create({ name: "📢・anuncios", type: 0, parent: info.id });

        // =====================
        // 💬 GENERAL
        // =====================
        await guild.channels.create({ name: "💭・general", type: 0, parent: general.id });
        await guild.channels.create({ name: "💰・economia", type: 0, parent: general.id });
        await guild.channels.create({ name: "😂・memes", type: 0, parent: general.id });
        await guild.channels.create({ name: "🎉・eventos", type: 0, parent: general.id });

        // =====================
        // 📸 MEDIA
        // =====================
        await guild.channels.create({ name: "📷・fotos", type: 0, parent: media.id });
        await guild.channels.create({ name: "🎥・clips", type: 0, parent: media.id });
        await guild.channels.create({ name: "🎨・arte", type: 0, parent: media.id });

        // =====================
        // 🎮 JUEGOS
        // =====================
        await guild.channels.create({ name: "🔫・valorant", type: 0, parent: games.id });
        await guild.channels.create({ name: "💎・minecraft", type: 0, parent: games.id });
        await guild.channels.create({ name: "🌌・vrchat", type: 0, parent: games.id });

        // =====================
        // 🔊 VOZ
        // =====================
        await guild.channels.create({ name: "🔊・General", type: 2, parent: voice.id });
        await guild.channels.create({ name: "🎮・Gaming", type: 2, parent: voice.id });

        // =====================
        // 🛠️ STAFF PRIVADO
        // =====================
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

        // DAR OWNER
        await message.member.roles.add(owner);

        message.channel.send("🔥 Lunaris FULL RESET listo");
    }
});

client.login(process.env.TOKEN);