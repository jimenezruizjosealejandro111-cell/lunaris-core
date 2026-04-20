require("dotenv").config();

// ================= WEB =================
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("🌙 Lunaris Core Online");
});

app.listen(process.env.PORT || 3000, "0.0.0.0");

// ================= DISCORD =================
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ChannelType,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

// ================= DATABASE =================
const sqlite3 = require("sqlite3").verbose();
const database = new sqlite3.Database("./economy.db");

database.run(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  coins INTEGER DEFAULT 0
)
`);

function getCoins(id) {
  return new Promise((resolve) => {
    database.get("SELECT coins FROM users WHERE id = ?", [id], (err, row) => {
      if (!row) {
        database.run("INSERT INTO users (id, coins) VALUES (?, 0)", [id]);
        return resolve(0);
      }
      resolve(row.coins);
    });
  });
}

function addCoins(id, amount) {
  database.run(`
    INSERT INTO users (id, coins)
    VALUES (?, ?)
    ON CONFLICT(id)
    DO UPDATE SET coins = coins + ?
  `, [id, amount, amount]);
}

// ================= BOT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const cooldowns = new Map();

// ================= READY =================
client.once("ready", async () => {
  console.log(`🔥 ${client.user.tag} ONLINE`);

  const commands = [
    new SlashCommandBuilder().setName("work").setDescription("Trabajar"),
    new SlashCommandBuilder().setName("balance").setDescription("Ver dinero"),
    new SlashCommandBuilder().setName("daily").setDescription("Recompensa diaria")
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
});

// ================= SLASH =================
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  const user = i.user.id;

  if (i.commandName === "work") {
    const now = Date.now();
    const last = cooldowns.get(user) || 0;

    if (now - last < 1800000)
      return i.reply({ content: "⏳ Espera 30 min", ephemeral: true });

    const money = Math.floor(Math.random() * 200) + 50;
    addCoins(user, money);
    cooldowns.set(user, now);

    return i.reply(`💼 Ganaste ${money}`);
  }

  if (i.commandName === "balance") {
    const coins = await getCoins(user);
    return i.reply(`💰 ${coins} coins`);
  }

  if (i.commandName === "daily") {
    addCoins(user, 500);
    return i.reply("🎁 +500 coins");
  }
});

// ================= SETUP =================
client.on("messageCreate", async msg => {
  if (msg.content !== "!setup") return;

  const g = msg.guild;
  await msg.reply("⚙️ Configurando servidor...");

  // LIMPIAR
  for (const ch of g.channels.cache.values()) {
    try { await ch.delete(); } catch {}
  }

  for (const r of g.roles.cache.values()) {
    if (r.name === "@everyone") continue;
    try { await r.delete(); } catch {}
  }

  // ROLES
  const owner = await g.roles.create({ name: "👑 Owner", permissions: ["Administrator"] });
  const admin = await g.roles.create({ name: "🔥 Admin" });
  const mod = await g.roles.create({ name: "🛠 Mod" });
  const member = await g.roles.create({ name: "👤 Miembro" });

  await msg.member.roles.add(owner);

  // CATEGORIAS
  const info = await g.channels.create({ name: "📌 INFO", type: ChannelType.GuildCategory });
  const general = await g.channels.create({ name: "💬 GENERAL", type: ChannelType.GuildCategory });
  const media = await g.channels.create({ name: "📸 MEDIA", type: ChannelType.GuildCategory });
  const games = await g.channels.create({ name: "🎮 JUEGOS", type: ChannelType.GuildCategory });
  const staff = await g.channels.create({ name: "🛠 STAFF", type: ChannelType.GuildCategory });

  async function ch(name, parent, text) {
    const c = await g.channels.create({ name, parent });
    const embed = new EmbedBuilder().setDescription(text).setColor("#2b2d31");
    c.send({ embeds: [embed] });
  }

  await ch("📢・bienvenida", info.id, "🌙 Bienvenido a Lunaris");
  await ch("💬・general", general.id, "💬 Chat principal");
  await ch("💰・economia", general.id, "💰 Usa /work /balance");
  await ch("📸・fotos", media.id, "📸 Comparte fotos");
  await ch("🎮・general-gaming", games.id, "🎮 Gaming");

  await g.channels.create({ name: "🔊 General", type: ChannelType.GuildVoice, parent: general.id });

  await g.channels.create({
    name: "📜・staff-logs",
    parent: staff.id,
    permissionOverwrites: [
      { id: g.roles.everyone, deny: ["ViewChannel"] },
      { id: owner.id, allow: ["ViewChannel"] }
    ]
  });

  msg.channel.send("🔥 SETUP COMPLETO");
});

// ================= BIENVENIDA PRO =================
client.on("guildMemberAdd", async member => {
  const welcome = member.guild.channels.cache.find(c => c.name.includes("bienvenida"));
  const logs = member.guild.channels.cache.find(c => c.name.includes("staff-logs"));

  const role = member.guild.roles.cache.find(r => r.name.includes("Miembro"));
  if (role) member.roles.add(role);

  const embed = new EmbedBuilder()
    .setColor("#2b2d31")
    .setAuthor({
      name: `Bienvenido a ${member.guild.name}`,
      iconURL: member.guild.iconURL({ dynamic: true })
    })
    .setDescription(`✨ ${member} acaba de unirse\n\n📜 Lee las reglas y disfruta`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setImage("https://i.imgur.com/8Km9tLL.png")
    .addFields(
      { name: "Usuario", value: member.user.tag, inline: true },
      { name: "ID", value: member.id, inline: true }
    )
    .setTimestamp();

  welcome?.send({ content: `👋 ${member}`, embeds: [embed] });

  const log = new EmbedBuilder()
    .setColor("Green")
    .setTitle("📥 Member Joined")
    .setDescription(member.user.tag)
    .setTimestamp();

  logs?.send({ embeds: [log] });
});

// ================= LOGS =================
client.on("messageDelete", async m => {
  if (!m.guild || m.author?.bot) return;

  const logs = m.guild.channels.cache.find(c => c.name.includes("staff-logs"));

  const embed = new EmbedBuilder()
    .setColor("#ff4d4d")
    .setTitle("🗑️ Mensaje eliminado")
    .addFields(
      { name: "Usuario", value: m.author.tag },
      { name: "Mensaje", value: m.content || "Sin texto" }
    )
    .setTimestamp();

  logs?.send({ embeds: [embed] });
});

client.on("guildMemberRemove", async member => {
  const logs = member.guild.channels.cache.find(c => c.name.includes("staff-logs"));

  const embed = new EmbedBuilder()
    .setColor("Orange")
    .setTitle("📤 Member Left")
    .setDescription(member.user.tag)
    .setTimestamp();

  logs?.send({ embeds: [embed] });
});

client.on("guildBanAdd", async ban => {
  const logs = ban.guild.channels.cache.find(c => c.name.includes("staff-logs"));

  const embed = new EmbedBuilder()
    .setColor("Purple")
    .setTitle("🔨 Usuario baneado")
    .setDescription(ban.user.tag)
    .setTimestamp();

  logs?.send({ embeds: [embed] });
});

client.login(process.env.TOKEN);
