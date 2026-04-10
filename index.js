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
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ================= ECONOMIA =================
const db = new Map();
const cooldowns = new Map();

// ================= READY =================
client.once("ready", async () => {
  console.log(`🔥 ${client.user.tag} ONLINE`);

  const commands = [
    new SlashCommandBuilder().setName("work").setDescription("Trabajar"),
    new SlashCommandBuilder().setName("balance").setDescription("Ver dinero"),
    new SlashCommandBuilder().setName("daily").setDescription("Recompensa diaria"),
    new SlashCommandBuilder().setName("shop").setDescription("Tienda"),
    new SlashCommandBuilder()
      .setName("buy")
      .setDescription("Comprar")
      .addStringOption(o =>
        o.setName("item").setDescription("Item").setRequired(true))
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
});

// ================= SLASH =================
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  const user = i.user.id;
  if (!db.has(user)) db.set(user, 0);

  if (i.commandName === "work") {
    const now = Date.now();
    const last = cooldowns.get(user) || 0;

    if (now - last < 1800000)
      return i.reply({ content: "⏳ Espera 30 min", ephemeral: true });

    const money = Math.floor(Math.random() * 200) + 50;
    db.set(user, db.get(user) + money);
    cooldowns.set(user, now);

    return i.reply(`💼 Ganaste ${money}`);
  }

  if (i.commandName === "balance") {
    return i.reply(`💰 ${db.get(user)} coins`);
  }

  if (i.commandName === "daily") {
    db.set(user, db.get(user) + 500);
    return i.reply("🎁 +500 coins");
  }

  if (i.commandName === "shop") {
    return i.reply("🛒 VRChat+ = 20000 coins");
  }

  if (i.commandName === "buy") {
    if (db.get(user) < 20000)
      return i.reply("❌ No tienes dinero");

    db.set(user, db.get(user) - 20000);
    return i.reply("✅ Compraste VRChat+");
  }
});

// ================= SETUP LIMPIO =================
client.on("messageCreate", async msg => {
  if (msg.content !== "!setup") return;

  const g = msg.guild;
  await msg.reply("⚙️ Reiniciando servidor...");

  // BORRAR CANALES
  for (const ch of g.channels.cache.values()) {
    try { await ch.delete(); } catch {}
  }

  // BORRAR ROLES
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

  // CATEGORÍAS
  const info = await g.channels.create({ name: "📌 INFO", type: ChannelType.GuildCategory });
  const general = await g.channels.create({ name: "💬 GENERAL", type: ChannelType.GuildCategory });
  const media = await g.channels.create({ name: "📸 MEDIA", type: ChannelType.GuildCategory });
  const games = await g.channels.create({ name: "🎮 JUEGOS", type: ChannelType.GuildCategory });
  const ticketsCat = await g.channels.create({ name: "🎟️ TICKETS", type: ChannelType.GuildCategory });
  const staff = await g.channels.create({ name: "🛠 STAFF", type: ChannelType.GuildCategory });

  // INFO
  await g.channels.create({ name: "📢・bienvenida", parent: info.id });
  await g.channels.create({ name: "📣・anuncios", parent: info.id });

  // GENERAL
  await g.channels.create({ name: "💬・general", parent: general.id });
  await g.channels.create({ name: "💰・economia", parent: general.id });
  await g.channels.create({ name: "😂・memes", parent: general.id });
  await g.channels.create({ name: "🎉・eventos", parent: general.id });

  // MEDIA
  await g.channels.create({ name: "📸・fotos", parent: media.id });
  await g.channels.create({ name: "🎬・clips", parent: media.id });
  await g.channels.create({ name: "🎨・arte", parent: media.id });
  await g.channels.create({ name: "📱・selfies", parent: media.id });

  // JUEGOS
  await g.channels.create({ name: "🎮・general-gaming", parent: games.id });
  await g.channels.create({ name: "🔫・valorant", parent: games.id });
  await g.channels.create({ name: "⛏️・minecraft", parent: games.id });
  await g.channels.create({ name: "🌌・vrchat", parent: games.id });
  await g.channels.create({ name: "🕹️・otros-juegos", parent: games.id });

  // VOICE GENERAL
  await g.channels.create({ name: "🔊・General", type: ChannelType.GuildVoice, parent: general.id });
  await g.channels.create({ name: "🎧・Chill", type: ChannelType.GuildVoice, parent: general.id });

  // VOICE GAMING
  await g.channels.create({ name: "🎮・Gaming 1", type: ChannelType.GuildVoice, parent: games.id });
  await g.channels.create({ name: "🎮・Gaming 2", type: ChannelType.GuildVoice, parent: games.id });

  // STAFF PRIVADO
  await g.channels.create({
    name: "📜・staff-logs",
    parent: staff.id,
    permissionOverwrites: [
      { id: g.roles.everyone, deny: ["ViewChannel"] },
      { id: owner.id, allow: ["ViewChannel"] },
      { id: admin.id, allow: ["ViewChannel"] }
    ]
  });

  await g.channels.create({
    name: "💬・staff-chat",
    parent: staff.id,
    permissionOverwrites: [
      { id: g.roles.everyone, deny: ["ViewChannel"] },
      { id: owner.id, allow: ["ViewChannel"] }
    ]
  });

  await g.channels.create({
    name: "🔒・Staff Voice",
    type: ChannelType.GuildVoice,
    parent: staff.id,
    permissionOverwrites: [
      { id: g.roles.everyone, deny: ["ViewChannel"] },
      { id: owner.id, allow: ["ViewChannel"] },
      { id: admin.id, allow: ["ViewChannel"] }
    ]
  });

  // TICKETS
  const ticketPanel = await g.channels.create({
    name: "🎫・crear-ticket",
    parent: ticketsCat.id
  });

  const embed = new EmbedBuilder()
    .setTitle("🎟️ Sistema de Tickets")
    .setDescription("Presiona el botón para crear un ticket");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket")
      .setLabel("Crear Ticket")
      .setStyle(ButtonStyle.Primary)
  );

  await ticketPanel.send({ embeds: [embed], components: [row] });

  msg.channel.send("🔥 Setup completo PRO");
});

// ================= TICKETS =================
client.on("interactionCreate", async i => {
  if (!i.isButton()) return;

  if (i.customId === "ticket") {
    const ch = await i.guild.channels.create({
      name: `ticket-${i.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: i.guild.roles.everyone, deny: ["ViewChannel"] },
        { id: i.user.id, allow: ["ViewChannel"] }
      ]
    });

    ch.send("🎟 Ticket creado");
    i.reply({ content: "✅ Ticket creado", ephemeral: true });
  }
});

// ================= AUTOROL =================
client.on("guildMemberAdd", member => {
  const role = member.guild.roles.cache.find(r => r.name.includes("Miembro"));
  if (role) member.roles.add(role);
});

// ================= LOGS =================
function logs(guild) {
  return guild.channels.cache.find(c => c.name === "📜・staff-logs");
}

client.on("messageDelete", m => {
  if (!m.guild || m.author?.bot) return;
  logs(m.guild)?.send(`🗑️ ${m.author.tag}: ${m.content}`);
});

client.on("messageUpdate", (o, n) => {
  if (!o.guild || o.author?.bot) return;
  logs(o.guild)?.send(`✏️ ${o.author.tag}: ${o.content} → ${n.content}`);
});

client.on("guildMemberAdd", m => {
  logs(m.guild)?.send(`📥 ${m.user.tag} entró`);
});

client.on("guildMemberRemove", m => {
  logs(m.guild)?.send(`📤 ${m.user.tag} salió`);
});

// ================= LOGIN =================
client.login(process.env.TOKEN);
