require("dotenv").config();

// ================= WEB (FIX 502) =================
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
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

// ⚠️ INTENTS COMPLETOS (FIX SETUP)
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
  console.log(`✅ ${client.user.tag} ONLINE`);

  const commands = [
    new SlashCommandBuilder().setName("work").setDescription("Trabajar"),
    new SlashCommandBuilder().setName("balance").setDescription("Ver dinero"),
    new SlashCommandBuilder().setName("daily").setDescription("Recompensa diaria"),
    new SlashCommandBuilder().setName("shop").setDescription("Tienda"),
    new SlashCommandBuilder()
      .setName("buy")
      .setDescription("Comprar")
      .addStringOption(o =>
        o.setName("item")
          .setDescription("Item")
          .setRequired(true))
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
});

// ================= SLASH =================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const user = interaction.user.id;
  if (!db.has(user)) db.set(user, 0);

  if (interaction.commandName === "work") {
    const now = Date.now();
    const last = cooldowns.get(user) || 0;

    if (now - last < 1800000)
      return interaction.reply({ content: "⏳ Espera 30 min", ephemeral: true });

    const money = Math.floor(Math.random() * 200) + 50;
    db.set(user, db.get(user) + money);
    cooldowns.set(user, now);

    return interaction.reply(`💼 Ganaste ${money}`);
  }

  if (interaction.commandName === "balance") {
    return interaction.reply(`💰 ${db.get(user)} coins`);
  }

  if (interaction.commandName === "daily") {
    db.set(user, db.get(user) + 500);
    return interaction.reply("🎁 +500 coins");
  }

  if (interaction.commandName === "shop") {
    return interaction.reply("🛒 VRChat+ = 20000 coins");
  }

  if (interaction.commandName === "buy") {
    const item = interaction.options.getString("item");

    if (item === "vrchat+") {
      if (db.get(user) < 20000)
        return interaction.reply("❌ No tienes dinero");

      db.set(user, db.get(user) - 20000);
      return interaction.reply("✅ Compraste VRChat+");
    }
  }
});

// ================= SETUP =================
client.on("messageCreate", async msg => {
  if (msg.content !== "!setup") return;

  const g = msg.guild;

  // ROLES
  const owner = await g.roles.create({ name: "👑 Owner" });
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
  const ticketsCat = await g.channels.create({ name: "🎟️ TICKETS", type: ChannelType.GuildCategory });

  // CANALES
  await g.channels.create({ name: "📢・bienvenida", parent: info.id });
  await g.channels.create({ name: "📣・anuncios", parent: info.id });

  await g.channels.create({ name: "💬・general", parent: general.id });
  await g.channels.create({ name: "💰・economia", parent: general.id });
  await g.channels.create({ name: "😂・memes", parent: general.id });
  await g.channels.create({ name: "🎉・eventos", parent: general.id });

  await g.channels.create({ name: "📸・fotos", parent: media.id });
  await g.channels.create({ name: "🎬・clips", parent: media.id });

  await g.channels.create({ name: "🔫・valorant", parent: games.id });
  await g.channels.create({ name: "⛏️・minecraft", parent: games.id });
  await g.channels.create({ name: "🌌・vrchat", parent: games.id });

  // STAFF PRIVADO
  const staffLogs = await g.channels.create({
    name: "📜・staff-logs",
    parent: staff.id,
    permissionOverwrites: [
      { id: g.roles.everyone, deny: ["ViewChannel"] },
      { id: msg.member.id, allow: ["ViewChannel"] }
    ]
  });

  await g.channels.create({
    name: "💬・staff-chat",
    parent: staff.id,
    permissionOverwrites: [
      { id: g.roles.everyone, deny: ["ViewChannel"] },
      { id: msg.member.id, allow: ["ViewChannel"] }
    ]
  });

  await g.channels.create({
    name: "📁・tickets-cerrados",
    parent: staff.id,
    permissionOverwrites: [
      { id: g.roles.everyone, deny: ["ViewChannel"] },
      { id: msg.member.id, allow: ["ViewChannel"] }
    ]
  });

  // PANEL TICKETS
  const ticketPanel = await g.channels.create({
    name: "🎫・crear-ticket",
    parent: ticketsCat.id
  });

  const embed = new EmbedBuilder()
    .setTitle("🎟️ Tickets")
    .setDescription("Presiona el botón");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket")
      .setLabel("Crear Ticket")
      .setStyle(ButtonStyle.Primary)
  );

  await ticketPanel.send({ embeds: [embed], components: [row] });

  msg.reply("🔥 Setup completo");
});

// ================= TICKETS =================
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "ticket") {
    const ch = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone, deny: ["ViewChannel"] },
        { id: interaction.user.id, allow: ["ViewChannel"] }
      ]
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("close")
        .setLabel("Cerrar")
        .setStyle(ButtonStyle.Danger)
    );

    ch.send({ content: "🎟 Ticket creado", components: [row] });
    interaction.reply({ content: "✅ Ticket creado", ephemeral: true });
  }

  if (interaction.customId === "close") {
    await interaction.channel.delete();
  }
});

// ================= AUTOROL =================
client.on("guildMemberAdd", member => {
  const role = member.guild.roles.cache.find(r => r.name.includes("Miembro"));
  if (role) member.roles.add(role);
});

// ================= LOGIN =================
client.login(process.env.TOKEN);
