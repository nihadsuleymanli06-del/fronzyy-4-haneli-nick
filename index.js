import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActivityType,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags
} from 'discord.js';
import express from 'express';

// --- UPTIME VE PORT İÇİN EXPRESS SUNUCUSU ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Fronzyy 4 Haneli Nick Botu aktif ve çalışıyor!');
});

app.listen(PORT, () => {
  console.log(`Express sunucusu ${PORT} portunda çalışıyor.`);
});
// -------------------------------------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

// Yetkili kişinin ID'si
const OWNER_ID = '1184518857679962186';

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789_';
let activeInterval = null;

function generate4CharNick() {
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return result;
}

client.once('ready', () => {
  console.log(`Bot başarıyla giriş yaptı: ${client.user.tag}`);

  client.user.setActivity({
    name: 'powered by Fronzyy',
    type: ActivityType.Playing
  });
});

// !panel-nick komutu
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!panel-nick' || message.content === '!panel-spam') {
    if (message.author.id !== OWNER_ID) {
      try {
        await message.delete();
      } catch (e) {}

      try {
        const warningMsg = await message.channel.send({
          content: `❌ <@${message.author.id}> Bu komutu sadece yönetici kullanabilir.`
        });

        setTimeout(async () => {
          try { await warningMsg.delete(); } catch (err) {}
        }, 5000);
      } catch (err) {}

      return;
    }

    try { await message.delete(); } catch (e) {}

    const container = new ContainerBuilder()
      .setAccentColor(0x2b2d31)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# **Fronzyy 4 Haneli Nick Botu**')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## **Ne İşe Yarar?**')
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('• 4 haneli (4 karakterli) uygun kullanıcı adlarını arar, boşta olan nick bulunduğunda sizi bilgilendirir ve dilerseniz otomatik olarak hesaba ayarlar.')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## **Nasıl Kullanılır?**')
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('• **▶️ Başlat** : Butona tıklayın, aralık (saniye) ve hedef/hesap bilgilerini girerek 4 haneli nick aramasını başlatın.')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('-# Copyright © Developed by Fronzyy 2026')
      );

    // Sadece ▶️ Başlat butonu
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('start_nick')
        .setLabel('Başlat')
        .setStyle(ButtonStyle.Success)
        .setEmoji('▶️')
    );

    await message.channel.send({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2
    });
  }
});

// Buton ve Modal etkileşimleri
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton() && interaction.customId === 'start_nick') {
    const modal = new ModalBuilder()
      .setCustomId('nick_start_modal')
      .setTitle('4 Haneli Nick Başlat');

    const accountTokenInput = new TextInputBuilder()
      .setCustomId('target_token')
      .setLabel('Hesap Tokeni')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const intervalInput = new TextInputBuilder()
      .setCustomId('interval_sec')
      .setLabel('Kaç saniyede bir denensin? (örn: 4)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const autoSetInput = new TextInputBuilder()
      .setCustomId('auto_set')
      .setLabel('Bulunan nicki otomatik koy? (evet/hayır)')
      .setPlaceholder('evet veya hayır')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(accountTokenInput),
      new ActionRowBuilder().addComponents(intervalInput),
      new ActionRowBuilder().addComponents(autoSetInput)
    );

    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'nick_start_modal') {
    const targetToken = interaction.fields.getTextInputValue('target_token').trim();
    const intervalSec = parseFloat(interaction.fields.getTextInputValue('interval_sec'));
    const autoSetRaw = interaction.fields.getTextInputValue('auto_set').trim().toLowerCase();
    const autoSet = autoSetRaw === 'evet' || autoSetRaw === 'yes' || autoSetRaw === 'true';

    if (isNaN(intervalSec) || intervalSec < 1) {
      return interaction.reply({ content: '❌ Geçerli bir süre (en az 1 saniye) girin!', ephemeral: true });
    }

    if (activeInterval) {
      clearInterval(activeInterval);
      activeInterval = null;
    }

    await interaction.reply({
      content: `▶️ **4 Haneli Nick** işlemi başlatıldı! (Aralık: **${intervalSec}s**, Otomatik Koy: **${autoSet ? 'Evet' : 'Hayır'}**)`,
      ephemeral: true
    });

    activeInterval = setInterval(async () => {
      const candidate = generate4CharNick();

      try {
        const res = await fetch('https://discord.com/api/v9/users/@me', {
          method: 'PATCH',
          headers: {
            'Authorization': targetToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username: candidate })
        });

        if (res.status === 200) {
          console.log(`[4 HANELİ NICK BULUNDU] Yeni Nick: ${candidate}`);
          clearInterval(activeInterval);
          activeInterval = null;
        } else if (res.status === 429) {
          const data = await res.json().catch(() => ({}));
          console.warn(`[RATE LIMIT] ${data.retry_after || '?'} saniye beklenmeli.`);
        } else {
          const errData = await res.json().catch(() => ({}));
          const rawErr = JSON.stringify(errData).toLowerCase();
          if (!rawErr.includes('username')) {
            console.log(`[BOŞ OLABİLİR] Nick: ${candidate} | Durum: ${res.status}`);
          }
        }
      } catch (err) {
        console.error('4 haneli nick kontrol hatası:', err.message);
      }
    }, intervalSec * 1000);
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ HATA: DISCORD_TOKEN environment değişkeni bulunamadı!');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
