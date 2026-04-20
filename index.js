require("dotenv").config();

// ================= WEB =================
const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("🌙 Lunaris Core Online"));
app.listen(process.env.PORT || 3000, "0.0.0.0");

// ================= DISCORD =================
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ChannelType,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField
} = require("discord.js");

// ================= DATABASE =================
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./economy.db");

db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, coins INTEGER DEFAULT 0)`);

function getCoins(id) {
  return new Promise(res => {
    db.get("SELECT coins FROM users WHERE id=?", [id], (e, r) => {
      if (!r) {
        db.run("INSERT INTO users (id, coins) VALUES (?,0)", [id]);
        return res(0);
      }
      res(r.coins);
    });
  });
}

function addCoins(id, amount) {
  db.run(`
    INSERT INTO users (id, coins)
    VALUES (?,?)
    ON CONFLICT(id) DO UPDATE SET coins = coins + ?
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

// ================= ANTI RAID =================
let joinTracker = new Map();
let antiRaidActive = false;

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

// ================= INTERACTIONS =================
client.on("interactionCreate", async i => {

  if (i.isChatInputCommand()) {

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
  }

  // PANEL ANUNCIOS PRO
  if (i.isButton() && i.customId === "crear_anuncio") {

    if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return i.reply({ content: "❌ No tienes permiso", ephemeral: true });

    const modal = new ModalBuilder()
      .setCustomId("modal_anuncio_pro")
      .setTitle("📢 Crear anuncio");

    const titulo = new TextInputBuilder()
      .setCustomId("titulo")
      .setLabel("Título")
      .setStyle(TextInputStyle.Short);

    const mensaje = new TextInputBuilder()
      .setCustomId("mensaje")
      .setLabel("Mensaje")
      .setStyle(TextInputStyle.Paragraph);

    const imagen = new TextInputBuilder()
      .setCustomId("imagen")
      .setLabel("URL Imagen (opcional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titulo),
      new ActionRowBuilder().addComponents(mensaje),
      new ActionRowBuilder().addComponents(imagen)
    );

    await i.showModal(modal);
  }

  if (i.isModalSubmit() && i.customId === "modal_anuncio_pro") {

    const titulo = i.fields.getTextInputValue("titulo");
    const mensaje = i.fields.getTextInputValue("mensaje");
    const imagen = i.fields.getTextInputValue("imagen");

    const canal = i.guild.channels.cache.find(c => c.name.includes("anuncios"));

    const embed = new EmbedBuilder()
      .setColor("#7a00ff")
      .setTitle(`📢 ${titulo}`)
      .setDescription(mensaje)
      .setFooter({ text: `Lunaris • ${i.user.tag}` })
      .setTimestamp();

    if (imagen) embed.setImage(imagen);

    canal?.send({
      content: "@everyone",
      embeds: [embed]
    });

    i.reply({ content: "✅ Anuncio enviado", ephemeral: true });
  }
});

// ================= PANEL + SETUP =================
client.on("messageCreate", async msg => {

  if (msg.content === "!panel-anuncios") {

    if (!msg.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return msg.reply("❌ No tienes permiso");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("crear_anuncio")
        .setLabel("📢 Crear Anuncio")
        .setStyle(ButtonStyle.Primary)
    );

    msg.channel.send({
      embeds: [new EmbedBuilder().setTitle("📢 Panel de Anuncios")],
      components: [row]
    });
  }

  if (msg.content === "!setup") {

    const g = msg.guild;

    await msg.reply("⚙️ Configurando...");

    for (const ch of g.channels.cache.values()) {
      try { await ch.delete(); } catch {}
    }

    for (const r of g.roles.cache.values()) {
      if (r.name !== "@everyone") {
        try { await r.delete(); } catch {}
      }
    }

    const owner = await g.roles.create({
      name: "👑 Owner",
      permissions: [PermissionsBitField.Flags.Administrator]
    });

    const member = await g.roles.create({ name: "👤 Miembro" });

    await msg.member.roles.add(owner);

    const info = await g.channels.create({ name: "📌 INFO", type: ChannelType.GuildCategory });
    const staff = await g.channels.create({ name: "🛠 STAFF", type: ChannelType.GuildCategory });

    await g.channels.create({ name: "📢・bienvenida", parent: info.id });
    await g.channels.create({ name: "📢・anuncios", parent: info.id });

    await g.channels.create({
      name: "📜・staff-logs",
      parent: staff.id,
      permissionOverwrites: [
        { id: g.roles.everyone, deny: ["ViewChannel"] },
        { id: owner.id, allow: ["ViewChannel"] }
      ]
    });

    msg.channel.send("🔥 SETUP COMPLETO");
  }
});

// ================= BIENVENIDA + ANTI RAID =================
client.on("guildMemberAdd", async member => {

  const logs = member.guild.channels.cache.find(c => c.name.includes("staff-logs"));
  const welcome = member.guild.channels.cache.find(c => c.name.includes("bienvenida"));

  const now = Date.now();
  const guildId = member.guild.id;

  if (!joinTracker.has(guildId)) joinTracker.set(guildId, []);

  const joins = joinTracker.get(guildId);
  joins.push(now);

  const recent = joins.filter(t => now - t < 10000);
  joinTracker.set(guildId, recent);

  if (recent.length >= 5 && !antiRaidActive) {

    antiRaidActive = true;

    member.guild.channels.cache.forEach(ch => {
      ch.permissionOverwrites.edit(member.guild.roles.everyone, {
        SendMessages: false
      }).catch(() => {});
    });

    logs?.send({
      embeds: [new EmbedBuilder().setColor("Red").setTitle("🚨 ANTI RAID ACTIVADO")]
    });

    setTimeout(() => {
      antiRaidActive = false;

      member.guild.channels.cache.forEach(ch => {
        ch.permissionOverwrites.edit(member.guild.roles.everyone, {
          SendMessages: true
        }).catch(() => {});
      });

      logs?.send({
        embeds: [new EmbedBuilder().setColor("Green").setTitle("✅ Anti-raid desactivado")]
      });

    }, 60000);
  }

  const role = member.guild.roles.cache.find(r => r.name.includes("Miembro"));
  if (role) member.roles.add(role);

  const imageURL = `https://api.popcat.xyz/welcomecard?background=https://cdn.discordapp.com/attachments/1495637775716978688/1495812926047518740/diana-y-leona.png&text1=${encodeURIComponent(member.user.username)}&text2=Bienvenido&text3=${member.guild.name}&avatar=${member.user.displayAvatarURL({ extension: "png" })}`;

  welcome?.send({
    content: `👋 ${member}`,
    embeds: [
      new EmbedBuilder()
        .setColor("#7a00ff")
        .setTitle("🌙 Bienvenido")
        .setImage(imageURL)
    ]
  });

  logs?.send({
    embeds: [
      new EmbedBuilder()
        .setColor("Green")
        .setTitle("📥 Usuario entró")
        .setDescription(member.user.tag)
    ]
  });
});

// ================= LOGS =================
client.on("messageDelete", async m => {
  if (!m.guild || m.author?.bot) return;

  const logs = m.guild.channels.cache.find(c => c.name.includes("staff-logs"));

  logs?.send({
    embeds: [
      new EmbedBuilder()
        .setColor("Red")
        .setTitle("🗑️ Mensaje eliminado")
        .setDescription(`${m.author.tag}: ${m.content || "Sin texto"}`)
    ]
  });
});

client.login(process.env.TOKEN);
