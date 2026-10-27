export const CONTACT_EMAIL = "truststackagent@gmail.com";

export const LEGAL_LANGS = [
  ["az", "Azərbaycanca"],
  ["ru", "Русский"],
  ["en", "English"],
];

const privacy = {
  az: {
    title: "Məxfilik Siyasəti",
    updated: "Son yenilənmə: 18 oktyabr 2026",
    sections: [
      {
        h: "1. Biz kimik",
        p: [
          "Flare AI (“Xidmət”) Flare Corporation (“biz”) tərəfindən idarə olunan süni intellekt çat köməkçisidir. Bu siyasət Xidmətin hansı şəxsi məlumatları nə üçün emal etdiyini və sizin hansı seçimlərinizin olduğunu izah edir.",
        ],
      },
      {
        h: "2. Emal etdiyimiz məlumatlar",
        p: [
          "- Hesab məlumatları: Google ilə (Firebase Authentication vasitəsilə) daxil olduqda adınızı, e-poçt ünvanınızı və profil şəkli bağlantısını alırıq. Ayarlarda seçdiyiniz profil şəkli yalnız brauzerinizdə qalır.",
          "- Söhbətlər: daxil olmuş istifadəçilər üçün mesajlar, söhbət başlıqları, vaxt qeydləri, əlavə edilmiş faylların adları və onlardan çıxarılan mətn serverimizdə saxlanılır. Daxil olmamış istifadəçilərin söhbətləri saxlanılmır və səhifə bağlananda və ya yenilənəndə silinir.",
          "- Yaddaş və ayarlar: cavabları fərdiləşdirmək üçün söhbətdə qeyd etdiyiniz qısa faktlar (məsələn, adınız və ya şəhəriniz) və ayarlarınız (ləqəb, xarakter, fərdi təlimatlar) saxlanıla bilər. Yaddaşı Ayarlarda söndürmək, görmək, ixrac etmək və silmək olar.",
          "- Rəylər: bəyən və ya bəyənmə düyməsini basdıqda həmin qiyməti, istəyə bağlı səbəbi, sualı və cavabı saxlayırıq. İxrac olunan rəy məlumatında adınız və e-poçtunuz olmur.",
          "- İstifadə və təhlükəsizlik məlumatları: mesaj limitlərini tətbiq etmək üçün mesajlarınızın vaxt qeydləri; ən azı 10 yaşda olduğunuzu təsdiqlədiyiniz tarix; hesabın dayandırılıb-dayandırılmadığı və səbəbi. Daxil olmamış istifadəçilər üçün mesajları saymaq məqsədilə heşlənmiş cihaz identifikatoru və heşlənmiş IP ünvanı istifadə olunur.",
        ],
      },
      {
        h: "3. Fayllar, səs və axtarış",
        p: [
          "- Fayllar: əlavə edilmiş fayl serverimizdə yalnız mətnini çıxarmaq üçün (şəkillərdə mətn tanıma daxil olmaqla) emal olunur. Faylın özü saxlanılmır; çıxarılan mətn (hər fayl üçün ən çox 6000 simvol) söhbətlə birlikdə saxlanılır.",
          "- Səslə yazma: səs brauzerinizin daxili nitq tanıma funksiyası ilə mətnə çevrilir. Chrome və Edge-də səs brauzer istehsalçısının serverlərinə göndərilir. Flare AI səsi qəbul etmir və saxlamır.",
          "- Veb axtarış: Axtarışı işə saldıqda mesajınızın mətni nəticələri tapmaq üçün üçüncü tərəf axtarış xidmətinə göndərilir. Belə mesajlara şəxsi məlumat yazmayın.",
        ],
      },
      {
        h: "4. Məlumatlardan necə istifadə edirik",
        p: [
          "Məlumatlardan Xidməti göstərmək və qorumaq, cavabları fərdiləşdirmək, limitləri və yaş qaydasını tətbiq etmək və cavab keyfiyyətini yaxşılaşdırmaq üçün istifadə edirik. Şəxsi məlumatları satmırıq və reklam göstərmirik.",
        ],
      },
      {
        h: "5. Süni intellekt emalı",
        p: [
          "Cavablar öz serverimizdə işləyən dil modeli tərəfindən yaradılır. Mesajlarınız üçüncü tərəf süni intellekt provayderlərinə göndərilmir.",
        ],
      },
      {
        h: "6. Xidmət təminatçıları",
        p: [
          "Daxil olma üçün Google, şəbəkə ötürülməsi üçün Cloudflare, Axtarış funksiyası üçün axtarış xidməti istifadə olunur. Onlar məlumatları öz siyasətlərinə uyğun emal edir.",
        ],
      },
      {
        h: "7. Saxlama və silmə",
        p: [
          `Söhbətlər və yaddaş siz silənə qədər saxlanılır. Ayarlarda “Məlumat İdarəetməsi” bölməsindən bir söhbəti və ya bütün söhbətləri silə, yaddaşı təmizləyə bilərsiniz. Rəy qeydləri və istifadə sayğacları xidməti yaxşılaşdırmaq və limitləri tətbiq etmək üçün lazım olan müddətdə saxlanılır. Hesab məlumatlarınızın silinməsini ${CONTACT_EMAIL} ünvanına yazaraq tələb edə bilərsiniz.`,
        ],
      },
      {
        h: "8. Hüquqlarınız",
        p: [
          `Şəxsi məlumatlarınıza çıxış, onların düzəldilməsi, silinməsi və ixracı hüququnuz var. Yaddaşı Ayarlardan özünüz idarə edə bilərsiniz; digər sorğular üçün ${CONTACT_EMAIL} ünvanına yazın.`,
        ],
      },
      {
        h: "9. Uşaqlar",
        p: [
          "Xidmət 10 və daha yuxarı yaşda olan istifadəçilər üçündür. 10 yaşdan kiçik istifadəçilərə bilərəkdən xidmət göstərmirik; bunu bildirən hesablar dayandırılır. Gənc istifadəçilər Xidmətdən valideyn və ya müəllimin məlumatı ilə istifadə etməlidir.",
        ],
      },
      {
        h: "10. Təhlükəsizlik",
        p: [
          "Məlumatlarınızı qorumaq üçün ağlabatan texniki tədbirlər görürük (giriş nəzarəti, kimlik doğrulama tokenlərinin yoxlanması). Heç bir sistem tam təhlükəsiz deyil.",
        ],
      },
      {
        h: "11. Dəyişikliklər",
        p: ["Bu siyasət yenilənə bilər. Cari versiya və yenilənmə tarixi bu səhifədə göstərilir."],
      },
      {
        h: "12. Əlaqə",
        p: [`Suallar üçün: ${CONTACT_EMAIL}`],
      },
    ],
  },
  ru: {
    title: "Политика конфиденциальности",
    updated: "Последнее обновление: 18 октября 2026 г.",
    sections: [
      {
        h: "1. Кто мы",
        p: [
          "Flare AI («Сервис») — чат-ассистент на основе искусственного интеллекта, которым управляет Flare Corporation («мы»). Эта политика объясняет, какие персональные данные обрабатывает Сервис, для чего и какие у вас есть варианты выбора.",
        ],
      },
      {
        h: "2. Какие данные мы обрабатываем",
        p: [
          "- Данные аккаунта: при входе через Google (с помощью Firebase Authentication) мы получаем ваше имя, адрес электронной почты и ссылку на фото профиля. Фото профиля, выбранное в настройках, остаётся только в вашем браузере.",
          "- Переписка: для вошедших пользователей на нашем сервере хранятся сообщения, названия чатов, время, а также названия прикреплённых файлов и извлечённый из них текст. Чаты пользователей, не вошедших в аккаунт, не сохраняются и исчезают при закрытии или обновлении страницы.",
          "- Память и настройки: для персонализации ответов могут сохраняться краткие факты, которые вы упоминаете (например, имя или город), и ваши настройки (псевдоним, характер, пользовательские инструкции). Память можно отключить, просмотреть, экспортировать и удалить в настройках.",
          "- Оценки ответов: если вы нажимаете «нравится» или «не нравится», мы сохраняем оценку, необязательную причину, вопрос и ответ. В экспортируемых данных оценок нет вашего имени и адреса электронной почты.",
          "- Данные об использовании и безопасности: время ваших сообщений для применения лимитов; дата подтверждения того, что вам не менее 10 лет; сведения о том, приостановлен ли аккаунт, и причина. Для пользователей, не вошедших в аккаунт, для подсчёта сообщений используются хешированный идентификатор устройства и хешированный IP-адрес.",
        ],
      },
      {
        h: "3. Файлы, голос и поиск",
        p: [
          "- Файлы: прикреплённый файл обрабатывается на нашем сервере только для извлечения текста (включая распознавание текста на изображениях). Сам файл не хранится; извлечённый текст (не более 6000 символов на файл) сохраняется вместе с чатом.",
          "- Голосовой ввод: речь преобразуется в текст встроенным в ваш браузер распознаванием речи. В Chrome и Edge звук отправляется на серверы разработчика браузера. Flare AI не получает и не хранит звук.",
          "- Веб-поиск: когда вы включаете «Поиск», текст вашего сообщения отправляется стороннему поисковому сервису для получения результатов. Не указывайте в таких сообщениях личную информацию.",
        ],
      },
      {
        h: "4. Как мы используем данные",
        p: [
          "Мы используем данные, чтобы предоставлять и защищать Сервис, персонализировать ответы, применять лимиты и возрастное правило и улучшать качество ответов. Мы не продаём персональные данные и не показываем рекламу.",
        ],
      },
      {
        h: "5. Обработка ИИ",
        p: [
          "Ответы создаёт языковая модель, работающая на нашем собственном сервере. Ваши сообщения не отправляются сторонним поставщикам ИИ.",
        ],
      },
      {
        h: "6. Поставщики услуг",
        p: [
          "Для входа используется Google, для передачи трафика — Cloudflare, для функции «Поиск» — поисковый сервис. Они обрабатывают данные в соответствии со своими политиками.",
        ],
      },
      {
        h: "7. Хранение и удаление",
        p: [
          `Переписка и память хранятся, пока вы их не удалите. В настройках, в разделе «Управление данными», можно удалить один чат или все чаты и очистить память. Записи оценок и счётчики использования хранятся столько, сколько необходимо для улучшения Сервиса и применения лимитов. Удаления данных аккаунта можно потребовать, написав на ${CONTACT_EMAIL}.`,
        ],
      },
      {
        h: "8. Ваши права",
        p: [
          `Вы вправе получить доступ к своим персональным данным, исправить, удалить и экспортировать их. Память вы можете контролировать самостоятельно в настройках; по другим вопросам пишите на ${CONTACT_EMAIL}.`,
        ],
      },
      {
        h: "9. Дети",
        p: [
          "Сервис предназначен для пользователей от 10 лет. Мы сознательно не предоставляем Сервис детям младше 10 лет; аккаунты, указывающие на это, приостанавливаются. Младшим пользователям следует пользоваться Сервисом с ведома родителей или учителя.",
        ],
      },
      {
        h: "10. Безопасность",
        p: [
          "Мы применяем разумные технические меры защиты данных (контроль доступа, проверка токенов аутентификации). Ни одна система не может быть абсолютно безопасной.",
        ],
      },
      {
        h: "11. Изменения",
        p: ["Эта политика может обновляться. Актуальная версия и дата обновления указаны на этой странице."],
      },
      {
        h: "12. Контакты",
        p: [`По вопросам пишите на ${CONTACT_EMAIL}.`],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    updated: "Last updated: 18 October 2026",
    sections: [
      {
        h: "1. Who we are",
        p: [
          "Flare AI (the “Service”) is an AI chat assistant operated by Flare Corporation (“we”). This policy explains what personal data the Service processes, why, and what choices you have.",
        ],
      },
      {
        h: "2. Data we process",
        p: [
          "- Account data: when you sign in with Google (through Firebase Authentication) we receive your name, email address and a link to your profile photo. A profile picture you choose in Settings stays in your browser only.",
          "- Conversations: for signed-in users, messages, chat titles, timestamps, and the names and extracted text of attached files are stored on our server. Chats of users who are not signed in are not stored and disappear when the page is closed or refreshed.",
          "- Memory and settings: short facts you mention (such as your name or city) can be saved to personalise answers, together with your settings (nickname, character, custom instructions). Memory can be switched off, viewed, exported and deleted in Settings.",
          "- Feedback: if you press like or dislike, we save that rating, the optional reason, the question and the answer. Exported feedback data does not contain your name or email.",
          "- Usage and safety data: timestamps of your messages to enforce message limits; the date you confirmed that you are at least 10 years old; whether your account is suspended and why. For users who are not signed in, a hashed device identifier and a hashed IP address are used to count messages.",
        ],
      },
      {
        h: "3. Files, voice and search",
        p: [
          "- Files: an attached file is processed on our server only to extract its text (including text recognition in images). The original file is not stored; the extracted text (at most 6000 characters per file) is saved with the chat.",
          "- Voice input: dictation uses the speech recognition built into your browser. In Chrome and Edge the audio is sent to the browser vendor’s servers. Flare AI does not receive or store audio.",
          "- Web search: when you turn on Search, the text of your message is sent to a third-party search service to find results. Do not include personal information in such messages.",
        ],
      },
      {
        h: "4. How we use data",
        p: [
          "We use data to provide and secure the Service, personalise answers, enforce limits and the age rule, and improve answer quality. We do not sell personal data and we do not show ads.",
        ],
      },
      {
        h: "5. AI processing",
        p: [
          "Answers are generated by a language model running on our own server. Your messages are not sent to third-party AI providers.",
        ],
      },
      {
        h: "6. Service providers",
        p: [
          "Google is used for sign-in, Cloudflare for network transport, and a search service for the Search feature. They process data under their own policies.",
        ],
      },
      {
        h: "7. Retention and deletion",
        p: [
          `Conversations and memory are kept until you delete them. In Settings, under Data Controls, you can delete a chat, delete all chats and clear memory. Feedback records and usage counters are kept as long as needed to improve the Service and enforce limits. You can request deletion of your account data by writing to ${CONTACT_EMAIL}.`,
        ],
      },
      {
        h: "8. Your rights",
        p: [
          `You have the right to access, correct, delete and export your personal data. You can manage memory yourself in Settings; for other requests write to ${CONTACT_EMAIL}.`,
        ],
      },
      {
        h: "9. Children",
        p: [
          "The Service is for users aged 10 and over. We do not knowingly provide the Service to children under 10; accounts indicating this are suspended. Younger users should use the Service with the knowledge of a parent or teacher.",
        ],
      },
      {
        h: "10. Security",
        p: [
          "We use reasonable technical measures to protect your data (access control, verification of authentication tokens). No system is completely secure.",
        ],
      },
      {
        h: "11. Changes",
        p: ["This policy may be updated. The current version and its date are shown on this page."],
      },
      {
        h: "12. Contact",
        p: [`Questions: ${CONTACT_EMAIL}`],
      },
    ],
  },
};

const terms = {
  az: {
    title: "İstifadə Şərtləri",
    updated: "Son yenilənmə: 18 oktyabr 2026",
    sections: [
      {
        h: "1. Qəbul",
        p: [
          "Flare Corporation (“biz”) tərəfindən idarə olunan Flare AI-dan (“Xidmət”) istifadə etməklə siz bu Şərtlərlə və Məxfilik Siyasəti ilə razılaşırsınız. Razı deyilsinizsə, Xidmətdən istifadə etməyin.",
        ],
      },
      {
        h: "2. Xidmət",
        p: [
          "Flare AI suallara cavab verən, yazı və öyrənmədə kömək edən, əlavə edilmiş faylları oxuyan, internetdə axtarış edə bilən və səslə yazmanı dəstəkləyən süni intellekt köməkçisidir. Cavablar dil modeli tərəfindən yaradılır və Xidmət inkişaf etdikcə dəyişə bilər.",
        ],
      },
      {
        h: "3. Yaş şərti",
        p: [
          "Ən azı 10 yaşınız olmalıdır. Daxil olduqdan sonra bunu təsdiq etməlisiniz. Mesajlarınız 10 yaşdan kiçik olduğunuzu göstərirsə, hesabınız dayandırılır. Gənc istifadəçilər Xidmətdən valideyn və ya müəllimin məlumatı ilə istifadə etməlidir.",
        ],
      },
      {
        h: "4. Hesabınız",
        p: [
          "Google hesabı ilə daxil olursunuz. Hesabınıza girişi təhlükəsiz saxlayın. Hesabınız altındakı fəaliyyətə görə siz məsuliyyət daşıyırsınız.",
        ],
      },
      {
        h: "5. Məqbul istifadə",
        p: [
          "Aşağıdakıları etməməyi qəbul edirsiniz:",
          "- qanunu və ya başqalarının hüquqlarını pozmaq;",
          "- nifrət dolu, təqib xarakterli, azyaşlıları cəlb edən cinsi məzmun, yaxud zorakılığı və ya özünə zərər verməyi təşviq edən məzmun yaratmaq və ya paylaşmaq;",
          "- başqalarının şəxsi məlumatlarını icazəsiz toplamaq və ya paylaşmaq;",
          "- mesaj limitlərini, yaş yoxlamasını və ya təhlükəsizlik tədbirlərini keçməyə, yaxud Xidmətə avtomatik (bot, məlumat yığma) giriş etməyə cəhd etmək;",
          "- Xidməti yükləmək və ya pozmaq, zərərli fayllar yükləmək;",
          "- istifadə hüququnuz olmayan fayl və ya məzmunu yükləmək.",
        ],
      },
      {
        h: "6. Mesaj limitləri",
        p: [
          "Xidməti qorumaq və ədalətli çıxışı təmin etmək üçün mesaj limitləri tətbiq olunur. Daxil olmamış istifadəçilər az sayda mesaj alır, daxil olmuş istifadəçilər üçün müəyyən vaxt ərzində limit var. Limitləri dəyişə bilərik.",
        ],
      },
      {
        h: "7. Sizin məzmununuz",
        p: [
          "Yazdığınız və yüklədiyiniz məzmunun hüquqları sizdə qalır. Siz bizə onu yalnız Məxfilik Siyasətində izah olunduğu kimi Xidməti işlətmək üçün lazım olan qədər emal etməyə və saxlamağa icazə verirsiniz. Fayllarınızı yükləmək hüququnuz olduğunu təsdiq edirsiniz. Cavablara verdiyiniz qiymətlər Xidməti yaxşılaşdırmaq üçün istifadə oluna bilər.",
        ],
      },
      {
        h: "8. Süni intellekt cavabları yanlış ola bilər",
        p: [
          "Xidmət yanlış, natamam və ya köhnəlmiş cavablar verə bilər. Vacib məlumatı etibarlı mənbələrdən yoxlayın. Cavablar tibbi, hüquqi, maliyyə və ya digər peşəkar məsləhət deyil. Veb axtarış nəticələri üçüncü tərəflərdən gəlir və biz onlara nəzarət etmirik.",
        ],
      },
      {
        h: "9. Dayandırma",
        p: [
          "Bu Şərtlər pozulduqda, yaş qaydası tətbiq olunduqda və ya Xidməti qorumaq üçün girişi məhdudlaşdıra və ya dayandıra bilərik. İstədiyiniz vaxt Xidmətdən istifadəni dayandıra, Ayarlarda söhbətlərinizi və yaddaşınızı silə bilərsiniz.",
        ],
      },
      {
        h: "10. Əlçatanlıq",
        p: ["Xidmət “olduğu kimi” təqdim olunur. İstənilən vaxt əlçatmaz ola və ya dəyişdirilə bilər."],
      },
      {
        h: "11. Məsuliyyət",
        p: [
          "Qanunun icazə verdiyi dərəcədə biz dolayı zərərlərə və ya Xidmətin cavablarına əsaslanaraq qəbul edilən qərarlara görə məsuliyyət daşımırıq.",
        ],
      },
      {
        h: "12. Tətbiq olunan hüquq",
        p: ["Bu Şərtlər Azərbaycan Respublikasının qanunvericiliyi ilə tənzimlənir."],
      },
      {
        h: "13. Dəyişikliklər və əlaqə",
        p: [`Bu Şərtləri yeniləyə bilərik; cari versiya və tarix bu səhifədə göstərilir. Suallar üçün: ${CONTACT_EMAIL}.`],
      },
    ],
  },
  ru: {
    title: "Условия использования",
    updated: "Последнее обновление: 18 октября 2026 г.",
    sections: [
      {
        h: "1. Принятие условий",
        p: [
          "Используя Flare AI («Сервис»), которым управляет Flare Corporation («мы»), вы соглашаетесь с настоящими Условиями и Политикой конфиденциальности. Если вы не согласны, не используйте Сервис.",
        ],
      },
      {
        h: "2. Сервис",
        p: [
          "Flare AI — ассистент на основе искусственного интеллекта: он отвечает на вопросы, помогает с текстами и учёбой, читает прикреплённые файлы, может искать информацию в интернете и поддерживает голосовой ввод. Ответы создаёт языковая модель; по мере развития Сервис может меняться.",
        ],
      },
      {
        h: "3. Возраст",
        p: [
          "Вам должно быть не менее 10 лет. Вы должны подтвердить это после входа. Если ваши сообщения указывают, что вам меньше 10 лет, ваш аккаунт приостанавливается. Младшим пользователям следует пользоваться Сервисом с ведома родителей или учителя.",
        ],
      },
      {
        h: "4. Ваш аккаунт",
        p: [
          "Вы входите через аккаунт Google. Обеспечьте безопасность доступа к нему. Вы отвечаете за действия под вашим аккаунтом.",
        ],
      },
      {
        h: "5. Допустимое использование",
        p: [
          "Вы обязуетесь не:",
          "- нарушать закон и права других лиц;",
          "- создавать или распространять контент, содержащий ненависть, травлю, сексуальные материалы с участием несовершеннолетних либо призывы к насилию или причинению себе вреда;",
          "- собирать или раскрывать персональные данные других людей без разрешения;",
          "- пытаться обойти лимиты сообщений, проверку возраста или меры безопасности, а также получать автоматический доступ к Сервису (боты, парсинг);",
          "- перегружать или нарушать работу Сервиса, загружать вредоносные файлы;",
          "- загружать файлы или контент, на использование которых у вас нет прав.",
        ],
      },
      {
        h: "6. Лимиты сообщений",
        p: [
          "Для защиты Сервиса и справедливого доступа действуют лимиты сообщений. Пользователи, не вошедшие в аккаунт, получают небольшое число сообщений, для вошедших действует лимит на период времени. Мы можем изменять лимиты.",
        ],
      },
      {
        h: "7. Ваш контент",
        p: [
          "Права на то, что вы пишете и загружаете, остаются за вами. Вы разрешаете нам обрабатывать и хранить это только в объёме, необходимом для работы Сервиса, как описано в Политике конфиденциальности. Вы подтверждаете, что имеете право загружать свои файлы. Оценки, которые вы ставите ответам, могут использоваться для улучшения Сервиса.",
        ],
      },
      {
        h: "8. Ответы ИИ могут быть неверными",
        p: [
          "Сервис может выдавать неверные, неполные или устаревшие ответы. Проверяйте важную информацию по надёжным источникам. Ответы не являются медицинской, юридической, финансовой или иной профессиональной консультацией. Результаты веб-поиска поступают от третьих лиц, и мы их не контролируем.",
        ],
      },
      {
        h: "9. Приостановка доступа",
        p: [
          "Мы можем ограничить или приостановить доступ при нарушении настоящих Условий, при применении возрастного правила или для защиты Сервиса. Вы можете в любой момент прекратить пользоваться Сервисом и удалить свои чаты и память в настройках.",
        ],
      },
      {
        h: "10. Доступность",
        p: ["Сервис предоставляется «как есть». Он может быть недоступен или изменён в любое время."],
      },
      {
        h: "11. Ответственность",
        p: [
          "В пределах, допустимых законом, мы не несём ответственности за косвенный ущерб и за решения, принятые на основании ответов Сервиса.",
        ],
      },
      {
        h: "12. Применимое право",
        p: ["Настоящие Условия регулируются законодательством Азербайджанской Республики."],
      },
      {
        h: "13. Изменения и контакты",
        p: [`Мы можем обновлять настоящие Условия; актуальная версия и дата указаны на этой странице. По вопросам пишите на ${CONTACT_EMAIL}.`],
      },
    ],
  },
  en: {
    title: "Terms of Service",
    updated: "Last updated: 18 October 2026",
    sections: [
      {
        h: "1. Acceptance",
        p: [
          "By using Flare AI (the “Service”), operated by Flare Corporation (“we”), you agree to these Terms and to the Privacy Policy. If you do not agree, do not use the Service.",
        ],
      },
      {
        h: "2. The Service",
        p: [
          "Flare AI is an AI assistant that answers questions, helps with writing and learning, reads attached files, can search the web and accepts voice dictation. Answers are generated by a language model, and the Service may change as it develops.",
        ],
      },
      {
        h: "3. Eligibility",
        p: [
          "You must be at least 10 years old. You must confirm this after signing in. If your messages indicate that you are younger than 10, your account is suspended. Younger users should use the Service with the knowledge of a parent or teacher.",
        ],
      },
      {
        h: "4. Your account",
        p: [
          "You sign in with a Google account. Keep access to it secure. You are responsible for activity under your account.",
        ],
      },
      {
        h: "5. Acceptable use",
        p: [
          "You agree not to:",
          "- break the law or violate the rights of others;",
          "- create or share content that is hateful, harassing, sexual involving minors, or that encourages violence or self-harm;",
          "- collect or share other people’s personal data without permission;",
          "- attempt to bypass message limits, the age check or security measures, or access the Service automatically (bots, scraping);",
          "- overload or disrupt the Service, or upload malicious files;",
          "- upload files or content that you have no right to use.",
        ],
      },
      {
        h: "6. Message limits",
        p: [
          "Message limits apply to protect the Service and ensure fair access. Users who are not signed in receive a small number of messages; signed-in users have a limit per time period. We may change the limits.",
        ],
      },
      {
        h: "7. Your content",
        p: [
          "You keep the rights to what you write and upload. You allow us to process and store it only as needed to operate the Service, as described in the Privacy Policy. You confirm that you have the right to upload your files. Ratings you give to answers may be used to improve the Service.",
        ],
      },
      {
        h: "8. AI answers may be wrong",
        p: [
          "The Service can produce incorrect, incomplete or outdated answers. Check important information with reliable sources. Answers are not medical, legal, financial or other professional advice. Web search results come from third parties and we do not control them.",
        ],
      },
      {
        h: "9. Suspension and termination",
        p: [
          "We may limit or suspend access if these Terms are violated, if the age rule applies, or to protect the Service. You may stop using the Service at any time and delete your chats and memory in Settings.",
        ],
      },
      {
        h: "10. Availability",
        p: ["The Service is provided “as is”. It may be unavailable or changed at any time."],
      },
      {
        h: "11. Liability",
        p: [
          "To the extent permitted by law, we are not liable for indirect damages or for decisions made on the basis of the Service’s answers.",
        ],
      },
      {
        h: "12. Governing law",
        p: ["These Terms are governed by the laws of the Republic of Azerbaijan."],
      },
      {
        h: "13. Changes and contact",
        p: [`We may update these Terms; the current version and date are shown on this page. Questions: ${CONTACT_EMAIL}.`],
      },
    ],
  },
};

export const LEGAL = { privacy, terms };
