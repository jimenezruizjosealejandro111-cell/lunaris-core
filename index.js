if (command === '!work') {
    const userId = message.author.id;
    const now = Date.now();
    const cooldown = 20 * 60 * 1000; // 20 minutos

    if (cooldowns.work.has(userId)) {
        const expiration = cooldowns.work.get(userId) + cooldown;

        if (now < expiration) {
            const timeLeft = ((expiration - now) / 1000 / 60).toFixed(1);
            return message.reply(`⏳ Espera ${timeLeft} minutos para trabajar otra vez`);
        }
    }

    cooldowns.work.set(userId, now);

    const amount = Math.floor(Math.random() * 100) + 50;

    getUser(userId, () => {
        updateBalance(userId, amount);
    });

    message.reply(`💼 Ganaste ${amount} monedas`);
}