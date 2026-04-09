require('dotenv').config();

console.log("🔥 LUNARIS LEGENDARY SYSTEM 🔥");

const express = require('express');
const { Client, GatewayIntentBits, Events, PermissionsBitField, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./data.db');

app.use(express.urlencoded({ extended: true }));

// =====================
// 🗄️ DATABASE
// =====================
db.run(`CREATE TABLE IF NOT EXISTS economy (userId TEXT PRIMARY KEY, balance INTEGER)`);
db.run(`CREATE TABLE IF NOT EXISTS levels (userId TEXT PRIMARY KEY, xp INTEGER, level INTEGER)`);

db.run(`
CREATE TABLE IF NOT EXISTS config (
    guildId TEXT PRIMARY KEY,
    welcome_channel TEXT,
    log_channel TEXT,
    auto_role TEXT
)
`);

// =====================
// 🌐 WEB
// =====================
app.get('/', (req, res) => {
    res.send("🌙 Lunaris Legendary Online");
});

// PANEL
app.get('/panel/:guildId', (req, res) => {

    const guildId = req.params.guildId;

    db.get("SELECT * FROM config WHERE guildId=?", [guildId], (err, row) => {

        res.send(`
        <h1>⚙️ Panel Lunaris</h1>

        <form method="POST" action="/save/${guildId}">
            <label>Canal Bienvenida:</label>
            <input name="welcome" value="${row?.welcome_channel || ""}"/><br>

            <label>Canal Logs:</label>
            <input name="logs" value="${row?.log_channel || ""}"/><br>

            <label>Autorol:</label>
            <input name="role" value="${row?.auto_role || ""}"/><br>

            <button type="submit">Guardar</button>
        </form>
        `);
    });
});

// GUARDAR CONFIG
app.post('/save/:guildId', (req, res) => {

    const guildId = req.params.guildId;
    const { welcome, logs, role } = req.body;

    db.run(`
    INSERT OR REPLACE INTO config VALUES (?,?,?,?)
    `, [guildId, welcome, logs, role]);

    res.send("✅ Config guardada");
});

app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log("🌐 WEB ONLINE");
});

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
function getLogs(guild){
    return new Promise(resolve=>{
        db.get("SELECT * FROM config WHERE guildId=?", [guild.id], (err,row)=>{
            if(!row) return resolve(null);
            resolve(guild.channels.cache.get(row.log_channel));
        });
    });
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
client.on(Events.GuildMemberAdd, async member => {

    db.get("SELECT * FROM config WHERE guildId=?", [member.guild.id], async (err,row)=>{

        if(!row) return;

        const channel = member.guild.channels.cache.get(row.welcome_channel);
        const role = member.guild.roles.cache.get(row.auto_role);

        if(role) await member.roles.add(role).catch(()=>{});

        const embed = new EmbedBuilder()
            .setColor("#a855f7")
            .setTitle("🌙 Bienvenido a Lunaris")
            .setDescription(`💜 ${member} ha llegado`)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        channel?.send({embeds:[embed]});
        (await getLogs(member.guild))?.send(`📥 ${member.user.tag} entró`);
    });
});

// SALIDA
client.on(Events.GuildMemberRemove, async member=>{
    (await getLogs(member.guild))?.send(`📤 ${member.user.tag} salió`);
});

// =====================
// LOGS MENSAJES
// =====================
client.on(Events.MessageDelete, async message=>{
    if(!message.guild || message.author?.bot) return;

    const embed = new EmbedBuilder()
        .setColor("#ff4d4d")
        .setTitle("🗑️ Mensaje eliminado")
        .addFields(
            {name:"Usuario", value:message.author?.tag || "?"},
            {name:"Contenido", value:message.content || "Vacío"}
        );

    (await getLogs(message.guild))?.send({embeds:[embed]});
});

client.on(Events.MessageUpdate, async (oldMsg,newMsg)=>{
    if(!oldMsg.guild || oldMsg.author?.bot) return;
    if(oldMsg.content === newMsg.content) return;

    const embed = new EmbedBuilder()
        .setColor("#f1c40f")
        .setTitle("✏️ Mensaje editado")
        .addFields(
            {name:"Usuario", value:oldMsg.author.tag},
            {name:"Antes", value:oldMsg.content || "Vacío"},
            {name:"Después", value:newMsg.content || "Vacío"}
        );

    (await getLogs(oldMsg.guild))?.send({embeds:[embed]});
});

// =====================
// AUTO REGISTRO
// =====================
client.on(Events.MessageCreate, message=>{
    if(message.author.bot) return;

    db.run(`INSERT OR IGNORE INTO economy VALUES (?,?)`, [message.author.id,0]);
    db.run(`INSERT OR IGNORE INTO levels VALUES (?,?,?)`, [message.author.id,0,1]);
});

// =====================
// XP
// =====================
client.on(Events.MessageCreate, message=>{
    if(message.author.bot) return;

    const xpGain = Math.floor(Math.random()*10)+5;

    db.get(`SELECT * FROM levels WHERE userId=?`,[message.author.id],(err,row)=>{

        let xp = (row?.xp||0)+xpGain;
        let level = row?.level||1;

        if(xp >= level*100){
            xp = 0;
            level++;
            message.channel.send(`🎉 ${message.author} subió a nivel ${level}`);
        }

        db.run(`INSERT OR REPLACE INTO levels VALUES (?,?,?)`,[message.author.id,xp,level]);
    });
});

// =====================
// COOLDOWNS
// =====================
const workCooldown = new Map();
const dailyCooldown = new Map();

// =====================
// COMANDOS
// =====================
client.on(Events.MessageCreate, async message=>{
    if(message.author.bot) return;

    const args = message.content.split(" ");
    const cmd = args[0];

    // BALANCE
    if(cmd==="!balance"){
        db.get(`SELECT * FROM economy WHERE userId=?`,[message.author.id],(err,row)=>{
            message.reply(`💰 ${row?.balance||0}`);
        });
    }

    // WORK (30 min)
    if(cmd==="!work"){
        const user = message.author.id;
        const now = Date.now();

        if(workCooldown.has(user) && now < workCooldown.get(user)){
            return message.reply("⏳ Espera 30 minutos");
        }

        workCooldown.set(user, now + 1800000);

        const money = Math.floor(Math.random()*100)+50;

        db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`,[money,user]);

        message.reply(`💼 Ganaste ${money}`);
    }

    // DAILY
    if(cmd==="!daily"){
        const user = message.author.id;
        const now = Date.now();

        if(dailyCooldown.has(user) && now < dailyCooldown.get(user)){
            return message.reply("⏳ Ya reclamaste tu daily");
        }

        dailyCooldown.set(user, now + 86400000);

        const money = Math.floor(Math.random()*200)+100;

        db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`,[money,user]);

        message.reply(`🎁 Daily ${money}`);
    }

    // SHOP
    if(cmd==="!shop"){
        message.reply(`
🛒 TIENDA LUNARIS

1️⃣ VRChat Plus - 20000 coins

Usa: !buy 1
`);
    }

    // BUY
    if(cmd==="!buy"){
        const item = args[1];

        db.get(`SELECT * FROM economy WHERE userId=?`,[message.author.id],(err,row)=>{

            let balance = row?.balance||0;

            if(item=="1"){
                if(balance < 20000) return message.reply("❌ No tienes suficiente");

                db.run(`UPDATE economy SET balance = balance - 20000 WHERE userId=?`,[message.author.id]);

                message.reply("🎮 Compraste VRChat Plus (contacta staff)");
            }
        });
    }

    // =====================
    // SETUP FULL
    // =====================
    if(cmd==="!setup" && args[1]==="lunaris"){

        if(!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        const guild = message.guild;

        await message.reply("🚀 Creando Lunaris...");

        for(const ch of guild.channels.cache.values()){
            try{ await ch.delete(); }catch{}
        }

        for(const role of guild.roles.cache.values()){
            if(role.name==="@everyone"||role.managed) continue;
            try{ await role.delete(); }catch{}
        }

        const owner = await guild.roles.create({name:"🌙 Owner",permissions:["Administrator"]});
        const admin = await guild.roles.create({name:"💎 Admin"});
        const mod = await guild.roles.create({name:"🔥 Mod"});
        const vip = await guild.roles.create({name:"✨ VIP"});
        const member = await guild.roles.create({name:"👤 Miembro"});

        const info = await guild.channels.create({name:"📌 INFORMACIÓN",type:4});
        const general = await guild.channels.create({name:"💬 GENERAL",type:4});
        const media = await guild.channels.create({name:"📸 MEDIA",type:4});
        const games = await guild.channels.create({name:"🎮 JUEGOS",type:4});
        const voice = await guild.channels.create({name:"🔊 VOZ",type:4});
        const staff = await guild.channels.create({name:"🛠️ STAFF",type:4});

        const welcome = await guild.channels.create({name:"👋・bienvenida",type:0,parent:info.id});
        await guild.channels.create({name:"📜・reglas",type:0,parent:info.id});
        await guild.channels.create({name:"📢・anuncios",type:0,parent:info.id});

        await guild.channels.create({name:"💭・general",type:0,parent:general.id});
        await guild.channels.create({name:"💰・economia",type:0,parent:general.id});
        await guild.channels.create({name:"😂・memes",type:0,parent:general.id});
        await guild.channels.create({name:"🎉・eventos",type:0,parent:general.id});

        await guild.channels.create({name:"📷・fotos",type:0,parent:media.id});
        await guild.channels.create({name:"🎥・clips",type:0,parent:media.id});
        await guild.channels.create({name:"🎨・arte",type:0,parent:media.id});

        await guild.channels.create({name:"🔫・valorant",type:0,parent:games.id});
        await guild.channels.create({name:"💎・minecraft",type:0,parent:games.id});
        await guild.channels.create({name:"🌌・vrchat",type:0,parent:games.id});

        await guild.channels.create({name:"🔊・General",type:2,parent:voice.id});
        await guild.channels.create({name:"🎮・Gaming",type:2,parent:voice.id});

        const logs = await guild.channels.create({
            name:"📊・staff-logs",
            type:0,
            parent:staff.id,
            permissionOverwrites:[
                {id:guild.roles.everyone,deny:["ViewChannel"]},
                {id:admin.id,allow:["ViewChannel"]},
                {id:mod.id,allow:["ViewChannel"]}
            ]
        });

        await guild.channels.create({
            name:"🧾・staff-chat",
            type:0,
            parent:staff.id,
            permissionOverwrites:[
                {id:guild.roles.everyone,deny:["ViewChannel"]},
                {id:admin.id,allow:["ViewChannel"]},
                {id:mod.id,allow:["ViewChannel"]}
            ]
        });

        // GUARDAR CONFIG AUTOMÁTICA
        db.run(`
        INSERT OR REPLACE INTO config VALUES (?,?,?,?)
        `,[guild.id, welcome.id, logs.id, member.id]);

        await message.member.roles.add(owner);

        message.channel.send("🔥 Lunaris listo (panel activo)");
    }
});

client.login(process.env.TOKEN);