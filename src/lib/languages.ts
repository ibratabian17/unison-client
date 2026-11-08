export interface LanguageItem {
  code: string
  name: string
  native?: string
}

const EXTRA_LANGUAGE_NAMES = new Map(
  "aa:Afar|ab:Abkhazian|ace:Acehnese|ach:Acoli|ada:Adangme|ady:Adyghe|ae:Avestan|aeb:Tunisian Arabic|af:Afrikaans|afh:Afrihili|agq:Aghem|ain:Ainu|ak:Akan|akk:Akkadian|akz:Alabama|ale:Aleut|aln:Gheg Albanian|alt:Southern Altai|am:Amharic|an:Aragonese|ang:Old English|ann:Obolo|anp:Angika|arc:Aramaic|arn:Mapuche|aro:Araona|arp:Arapaho|arq:Algerian Arabic|ars:Najdi Arabic|arw:Arawak|ary:Moroccan Arabic|arz:Egyptian Arabic|as:Assamese|asa:Asu|ase:American Sign Language|ast:Asturian|atj:Atikamekw|av:Avaric|avk:Kotava|awa:Awadhi|ay:Aymara|az:Azerbaijani|ba:Bashkir|bal:Baluchi|ban:Balinese|bar:Bavarian|bas:Basaa|bax:Bamun|bbc:Batak Toba|bbj:Ghomala|be:Belarusian|bej:Beja|bem:Bemba|bew:Betawi|bez:Bena|bfd:Bafut|bfq:Badaga|bg:Bulgarian|bgc:Haryanvi|bgn:Western Balochi|bho:Bhojpuri|bi:Bislama|bik:Bikol|bin:Bini|bjn:Banjar|bkm:Kom|bla:Siksiká|blo:Anii|blt:Tai Dam|bm:Bambara|bo:Tibetan|bpy:Bishnupriya|bqi:Bakhtiari|br:Breton|bra:Braj|brh:Brahui|brx:Bodo|bs:Bosnian|bss:Akoose|bua:Buriat|bug:Buginese|bum:Bulu|byn:Blin|byv:Medumba|ca:Catalan|cad:Caddo|car:Carib|cay:Cayuga|cch:Atsam|ccp:Chakma|ce:Chechen|ceb:Cebuano|cgg:Chiga|ch:Chamorro|chb:Chibcha|chg:Chagatai|chk:Chuukese|chm:Mari|chn:Chinook Jargon|cho:Choctaw|chp:Chipewyan|chr:Cherokee|chy:Cheyenne|cic:Chickasaw|ckb:Central Kurdish|clc:Chilcotin|co:Corsican|cop:Coptic|cps:Capiznon|cr:Cree|crg:Michif|crh:Crimean Tatar|crj:Southern East Cree|crk:Plains Cree|crl:Northern East Cree|crm:Moose Cree|crr:Carolina Algonquian|crs:Seselwa Creole French|csb:Kashubian|csw:Swampy Cree|cu:Church Slavic|cv:Chuvash|cy:Welsh|dak:Dakota|dar:Dargwa|dav:Taita|del:Delaware|den:Slave|dgr:Dogrib|din:Dinka|dje:Zarma|doi:Dogri|dsb:Lower Sorbian|dtp:Central Dusun|dua:Duala|dum:Middle Dutch|dv:Divehi|dyo:Jola-Fonyi|dyu:Dyula|dz:Dzongkha|dzg:Dazaga|ebu:Embu|ee:Ewe|efi:Efik|egl:Emilian|egy:Ancient Egyptian|eka:Ekajuk|elx:Elamite|enm:Middle English|eo:Esperanto|esu:Central Yupik|et:Estonian|eu:Basque|ewo:Ewondo|ext:Extremaduran|fan:Fang|ff:Fula|fit:Tornedalen Finnish|fj:Fijian|fo:Faroese|fon:Fon|frc:Cajun French|frm:Middle French|fro:Old French|frp:Arpitan|frr:Northern Frisian|frs:Eastern Frisian|fur:Friulian|fy:Western Frisian|ga:Irish|gaa:Ga|gag:Gagauz|gan:Gan Chinese|gay:Gayo|gba:Gbaya|gbz:Zoroastrian Dari|gd:Scottish Gaelic|gez:Geez|gil:Gilbertese|gl:Galician|glk:Gilaki|gmh:Middle High German|gn:Guarani|goh:Old High German|gon:Gondi|gor:Gorontalo|got:Gothic|grb:Grebo|grc:Ancient Greek|gsw:Swiss German|gu:Gujarati|guc:Wayuu|gur:Frafra|guz:Gusii|gv:Manx|gwi:Gwichʼin|ha:Hausa|hai:Haida|hak:Hakka Chinese|haw:Hawaiian|hax:Southern Haida|hif:Fiji Hindi|hil:Hiligaynon|hit:Hittite|hmn:Hmong|hnj:Hmong Njua|ho:Hiri Motu|hr:Croatian|hsb:Upper Sorbian|hsn:Xiang Chinese|ht:Haitian Creole|hup:Hupa|hur:Halkomelem|hy:Armenian|hz:Herero|ia:Interlingua|iba:Iban|ibb:Ibibio|ie:Interlingue|ig:Igbo|ii:Sichuan Yi|ik:Inupiaq|ikt:Western Canadian Inuktitut|ilo:Iloko|inh:Ingush|io:Ido|is:Icelandic|iu:Inuktitut|izh:Ingrian|jam:Jamaican Creole English|jbo:Lojban|jgo:Ngomba|jmc:Machame|jpr:Judeo-Persian|jrb:Judeo-Arabic|jut:Jutish|jv:Javanese|ka:Georgian|kaa:Kara-Kalpak|kab:Kabyle|kac:Kachin|kaj:Jju|kam:Kamba|kaw:Kawi|kbd:Kabardian|kbl:Kanembu|kcg:Tyap|kde:Makonde|kea:Kabuverdianu|kek:Qʼeqchiʼ|ken:Kenyang|kfo:Koro|kg:Kongo|kgp:Kaingang|kha:Khasi|kho:Khotanese|khq:Koyra Chiini|khw:Khowar|ki:Kikuyu|kiu:Kirmanjki|kj:Kuanyama|kk:Kazakh|kkj:Kako|kl:Kalaallisut|kln:Kalenjin|km:Khmer|kmb:Kimbundu|kn:Kannada|koi:Komi-Permyak|kok:Konkani|kos:Kosraean|kpe:Kpelle|kr:Kanuri|krc:Karachay-Balkar|kri:Krio|krj:Kinaray-a|krl:Karelian|kru:Kurukh|ks:Kashmiri|ksb:Shambala|ksf:Bafia|ksh:Colognian|ku:Kurdish|kum:Kumyk|kut:Kutenai|kv:Komi|kw:Cornish|kwk:Kwakʼwala|kxv:Kuvi|ky:Kyrgyz|la:Latin|lad:Ladino|lag:Langi|lah:Western Panjabi|lam:Lamba|lb:Luxembourgish|lez:Lezghian|lfn:Lingua Franca Nova|lg:Ganda|li:Limburgish|lij:Ligurian|lil:Lillooet|liv:Livonian|lkt:Lakota|lmo:Lombard|ln:Lingala|lo:Lao|lol:Mongo|lou:Louisiana Creole|loz:Lozi|lrc:Northern Luri|lsm:Saamia|lt:Lithuanian|ltg:Latgalian|lu:Luba-Katanga|lua:Luba-Lulua|lui:Luiseno|lun:Lunda|luo:Luo|lus:Mizo|luy:Luyia|lv:Latvian|lzh:Literary Chinese|lzz:Laz|mad:Madurese|maf:Mafa|mag:Magahi|mai:Maithili|mak:Makasar|man:Mandingo|mas:Masai|mde:Maba|mdf:Moksha|mdr:Mandar|men:Mende|mer:Meru|mfe:Morisyen|mg:Malagasy|mga:Middle Irish|mgh:Makhuwa-Meetto|mgo:Metaʼ|mh:Marshallese|mi:Māori|mic:Mi'kmaw|min:Minangkabau|mk:Macedonian|ml:Malayalam|mn:Mongolian|mnc:Manchu|mni:Manipuri|moe:Innu-aimun|moh:Mohawk|mos:Mossi|mr:Marathi|mrj:Western Mari|mt:Maltese|mua:Mundang|mus:Muscogee|mwl:Mirandese|mwr:Marwari|mwv:Mentawai|my:Burmese|mye:Myene|myv:Erzya|mzn:Mazanderani|na:Nauru|nan:Min Nan Chinese|nap:Neapolitan|naq:Nama|nd:North Ndebele|nds:Low German|ne:Nepali|new:Newari|ng:Ndonga|nia:Nias|niu:Niuean|njo:Ao Naga|nmg:Kwasio|nnh:Ngiemboon|nog:Nogai|non:Old Norse|nov:Novial|nqo:N’Ko|nr:South Ndebele|nso:Northern Sotho|nus:Nuer|nv:Navajo|nwc:Classical Newari|ny:Nyanja|nym:Nyamwezi|nyn:Nyankole|nyo:Nyoro|nzi:Nzima|oc:Occitan|oj:Ojibwa|ojb:Northwestern Ojibwa|ojc:Central Ojibwa|ojs:Oji-Cree|ojw:Western Ojibwa|oka:Okanagan|om:Oromo|or:Odia|os:Ossetic|osa:Osage|ota:Ottoman Turkish|pag:Pangasinan|pal:Pahlavi|pam:Pampanga|pap:Papiamento|pau:Palauan|pcd:Picard|pcm:Nigerian Pidgin|pdc:Pennsylvania German|pdt:Plautdietsch|peo:Old Persian|pfl:Palatine German|phn:Phoenician|pi:Pali|pis:Pijin|pms:Piedmontese|pnt:Pontic|pon:Pohnpeian|pqm:Maliseet-Passamaquoddy|prg:Prussian|pro:Old Provençal|ps:Pashto|qu:Quechua|quc:Kʼicheʼ|qug:Chimborazo Highland Quichua|raj:Rajasthani|rap:Rapanui|rar:Rarotongan|rgn:Romagnol|rhg:Rohingya|rif:Riffian|rm:Romansh|rn:Rundi|rof:Rombo|rom:Romany|rtm:Rotuman|rue:Rusyn|rug:Roviana|rup:Aromanian|rw:Kinyarwanda|rwk:Rwa|sa:Sanskrit|sad:Sandawe|sah:Yakut|sam:Samaritan Aramaic|saq:Samburu|sas:Sasak|sat:Santali|saz:Saurashtra|sba:Ngambay|sbp:Sangu|sc:Sardinian|scn:Sicilian|sco:Scots|sd:Sindhi|sdc:Sassarese Sardinian|sdh:Southern Kurdish|se:Northern Sami|see:Seneca|seh:Sena|sei:Seri|sel:Selkup|ses:Koyraboro Senni|sg:Sango|sga:Old Irish|sgs:Samogitian|shi:Tachelhit|shn:Shan|shu:Chadian Arabic|si:Sinhala|sid:Sidamo|sl:Slovenian|slh:Southern Lushootseed|sli:Lower Silesian|sly:Selayar|sm:Samoan|sma:Southern Sami|smj:Lule Sami|smn:Inari Sami|sms:Skolt Sami|sn:Shona|snk:Soninke|so:Somali|sog:Sogdien|sq:Albanian|sr:Serbian|srn:Sranan Tongo|srr:Serer|ss:Swati|ssy:Saho|st:Southern Sotho|stq:Saterland Frisian|str:Straits Salish|su:Sundanese|suk:Sukuma|sus:Susu|sux:Sumerian|swb:Comorian|syc:Classical Syriac|syr:Syriac|szl:Silesian|tce:Southern Tutchone|tcy:Tulu|tem:Timne|teo:Teso|ter:Tereno|tet:Tetum|tg:Tajik|tgx:Tagish|tht:Tahltan|ti:Tigrinya|tig:Tigre|tiv:Tiv|tk:Turkmen|tkl:Tokelauan|tkr:Tsakhur|tlh:Klingon|tli:Tlingit|tly:Talysh|tmh:Tamashek|tn:Tswana|to:Tongan|tog:Nyasa Tonga|tok:Toki Pona|tpi:Tok Pisin|tru:Turoyo|trv:Taroko|trw:Torwali|ts:Tsonga|tsd:Tsakonian|tsi:Tsimshian|tt:Tatar|ttm:Northern Tutchone|ttt:Muslim Tat|tum:Tumbuka|tvl:Tuvalu|twq:Tasawaq|ty:Tahitian|tyv:Tuvinian|tzm:Central Atlas Tamazight|udm:Udmurt|ug:Uyghur|uga:Ugaritic|umb:Umbundu|uz:Uzbek|vai:Vai|ve:Venda|vec:Venetian|vep:Veps|vls:West Flemish|vmf:Main-Franconian|vmw:Makhuwa|vo:Volapük|vot:Votic|vro:Võro|vun:Vunjo|wa:Walloon|wae:Walser|wal:Wolaytta|war:Waray|was:Washo|wbp:Warlpiri|wo:Wolof|wuu:Wu Chinese|xal:Kalmyk|xh:Xhosa|xmf:Mingrelian|xnr:Kangri|xog:Soga|yao:Yao|yap:Yapese|yav:Yangben|ybb:Yemba|yi:Yiddish|yo:Yoruba|yrl:Nheengatu|yue:Cantonese|za:Zhuang|zap:Zapotec|zbl:Blissymbols|zea:Zeelandic|zen:Zenaga|zgh:Standard Moroccan Tamazight|zu:Zulu|zun:Zuni|zza:Zaza"
    .split("|")
    .map((pair) => pair.split(":") as [string, string]),
)

export const EXTRA_LANGUAGE_CODES = [...EXTRA_LANGUAGE_NAMES.keys()]

export const CURATED_LANGUAGE_CODES = [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "nl",
  "sv",
  "da",
  "no",
  "fi",
  "pl",
  "cs",
  "sk",
  "hu",
  "ro",
  "el",
  "tr",
  "ru",
  "uk",
  "ja",
  "ko",
  "zh",
  "zh-Hant",
  "hi",
  "bn",
  "pa",
  "ta",
  "te",
  "ur",
  "id",
  "ms",
  "vi",
  "th",
  "fil",
  "ar",
  "he",
  "fa",
  "sw",
] as const

// 130+ languages supported by Google Translate / Unison API
export const TRANSLATE_LANGUAGES: LanguageItem[] = [
  { code: "af", name: "Afrikaans", native: "Afrikaans" },
  { code: "ak", name: "Akan / Twi", native: "Akan" },
  { code: "sq", name: "Albanian", native: "Shqip" },
  { code: "am", name: "Amharic", native: "አማርኛ" },
  { code: "ar", name: "Arabic", native: "العربية" },
  { code: "hy", name: "Armenian", native: "Հայերեն" },
  { code: "as", name: "Assamese", native: "অসমীয়া" },
  { code: "ay", name: "Aymara", native: "Aymar aru" },
  { code: "az", name: "Azerbaijani", native: "Azərbaycan" },
  { code: "bm", name: "Bambara", native: "Bamanankan" },
  { code: "eu", name: "Basque", native: "Euskara" },
  { code: "be", name: "Belarusian", native: "Беларуская" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "bho", name: "Bhojpuri", native: "भोजपुरी" },
  { code: "bs", name: "Bosnian", native: "Bosanski" },
  { code: "bg", name: "Bulgarian", native: "Български" },
  { code: "ca", name: "Catalan", native: "Català" },
  { code: "ceb", name: "Cebuano", native: "Bisaya" },
  { code: "ny", name: "Chichewa", native: "ChiCheŵa" },
  { code: "zh", name: "Chinese (Simplified)", native: "简体中文" },
  { code: "zh-Hant", name: "Chinese (Traditional)", native: "繁體中文" },
  { code: "co", name: "Corsican", native: "Corsu" },
  { code: "hr", name: "Croatian", native: "Hrvatski" },
  { code: "cs", name: "Czech", native: "Čeština" },
  { code: "da", name: "Danish", native: "Dansk" },
  { code: "dv", name: "Dhivehi", native: "ދިވެހި" },
  { code: "doi", name: "Dogri", native: "डोगरी" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "en", name: "English", native: "English" },
  { code: "eo", name: "Esperanto", native: "Esperanto" },
  { code: "et", name: "Estonian", native: "Eesti" },
  { code: "ee", name: "Ewe", native: "Èʋegbe" },
  { code: "fil", name: "Filipino (Tagalog)", native: "Wikang Filipino" },
  { code: "fi", name: "Finnish", native: "Suomi" },
  { code: "fr", name: "French", native: "Français" },
  { code: "fy", name: "Frisian", native: "Frysk" },
  { code: "gl", name: "Galician", native: "Galego" },
  { code: "ka", name: "Georgian", native: "ქართული" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "el", name: "Greek", native: "Ελληνικά" },
  { code: "gn", name: "Guarani", native: "Avañe'ẽ" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { code: "ht", name: "Haitian Creole", native: "Kreyòl ayisyen" },
  { code: "ha", name: "Hausa", native: "هَوُسَ" },
  { code: "haw", name: "Hawaiian", native: "ʻŌlelo Hawaiʻi" },
  { code: "he", name: "Hebrew", native: "עברית" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "hmn", name: "Hmong", native: "Hmoob" },
  { code: "hu", name: "Hungarian", native: "Magyar" },
  { code: "is", name: "Icelandic", native: "Íslenska" },
  { code: "ig", name: "Igbo", native: "Asụsụ Igbo" },
  { code: "ilo", name: "Ilocano", native: "Ilokano" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "ga", name: "Irish", native: "Gaeilge" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "jv", name: "Javanese", native: "Basa Jawa" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "kk", name: "Kazakh", native: "Қазақ тілі" },
  { code: "km", name: "Khmer", native: "ភាសាខ្មែរ" },
  { code: "rw", name: "Kinyarwanda", native: "Ikinyarwanda" },
  { code: "gom", name: "Konkani", native: "कोंकणी" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "kri", name: "Krio", native: "Krio" },
  { code: "ku", name: "Kurdish (Kurmanji)", native: "Kurdî" },
  { code: "ckb", name: "Kurdish (Sorani)", native: "کوردی" },
  { code: "ky", name: "Kyrgyz", native: "Кыргызча" },
  { code: "lo", name: "Lao", native: "ລາວ" },
  { code: "la", name: "Latin", native: "Latīna" },
  { code: "lv", name: "Latvian", native: "Latviešu" },
  { code: "ln", name: "Lingala", native: "Lingála" },
  { code: "lt", name: "Lithuanian", native: "Lietuvių" },
  { code: "lg", name: "Luganda", native: "Oluganda" },
  { code: "lb", name: "Luxembourgish", native: "Lëtzebuergesch" },
  { code: "mk", name: "Macedonian", native: "Македонски" },
  { code: "mai", name: "Maithili", native: "मैथिली" },
  { code: "mg", name: "Malagasy", native: "Fiteny malagasy" },
  { code: "ms", name: "Malay", native: "Bahasa Melayu" },
  { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "mt", name: "Maltese", native: "Malti" },
  { code: "mi", name: "Maori", native: "Māori" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "mni-Mtei", name: "Meiteilon (Manipuri)", native: "মৈতৈলোন্" },
  { code: "lus", name: "Mizo", native: "Mizo ṭawng" },
  { code: "mn", name: "Mongolian", native: "Монгол хэл" },
  { code: "my", name: "Myanmar (Burmese)", native: "မြန်မာစာ" },
  { code: "ne", name: "Nepali", native: "नेपाली" },
  { code: "no", name: "Norwegian", native: "Norsk" },
  { code: "or", name: "Odia (Oriya)", native: "ଓଡ଼ିଆ" },
  { code: "om", name: "Oromo", native: "Afaan Oromoo" },
  { code: "ps", name: "Pashto", native: "پښتو" },
  { code: "fa", name: "Persian (Farsi)", native: "فارسی" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "qu", name: "Quechua", native: "Runasimi" },
  { code: "ro", name: "Romanian", native: "Română" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "sm", name: "Samoan", native: "Gagana Samoa" },
  { code: "sa", name: "Sanskrit", native: "संस्कृतम्" },
  { code: "gd", name: "Scots Gaelic", native: "Gàidhlig" },
  { code: "nso", name: "Sepedi", native: "Sesotho sa Leboa" },
  { code: "sr", name: "Serbian", native: "Српски" },
  { code: "st", name: "Sesotho", native: "Sesotho" },
  { code: "sn", name: "Shona", native: "chiShona" },
  { code: "sd", name: "Sindhi", native: "سنڌي" },
  { code: "si", name: "Sinhala", native: "සිංහල" },
  { code: "sk", name: "Slovak", native: "Slovenčina" },
  { code: "sl", name: "Slovenian", native: "Slovenščina" },
  { code: "so", name: "Somali", native: "Soomaaliga" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "su", name: "Sundanese", native: "Basa Sunda" },
  { code: "sw", name: "Swahili", native: "Kiswahili" },
  { code: "sv", name: "Swedish", native: "Svenska" },
  { code: "tg", name: "Tajik", native: "Тоҷикӣ" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "tt", name: "Tatar", native: "Татар теле" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "th", name: "Thai", native: "ไทย" },
  { code: "ti", name: "Tigrinya", native: "ትግርኛ" },
  { code: "ts", name: "Tsonga", native: "Xitsonga" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "tk", name: "Turkmen", native: "Türkmen dili" },
  { code: "uk", name: "Ukrainian", native: "Українська" },
  { code: "ur", name: "Urdu", native: "اردو" },
  { code: "ug", name: "Uyghur", native: "ئۇيغۇرچە" },
  { code: "uz", name: "Uzbek", native: "Oʻzbekcha" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "cy", name: "Welsh", native: "Cymraeg" },
  { code: "xh", name: "Xhosa", native: "isiXhosa" },
  { code: "yi", name: "Yiddish", native: "ייִדיש" },
  { code: "yo", name: "Yoruba", native: "Èdè Yorùbá" },
  { code: "zu", name: "Zulu", native: "isiZulu" },
]

export const POPULAR_TRANSLATE_CODES = [
  "en",
  "ja",
  "ko",
  "zh",
  "zh-Hant",
  "es",
  "id",
  "fr",
  "de",
  "it",
  "pt",
  "ru",
  "vi",
  "th",
  "hi",
  "ar",
  "tr",
  "pl",
  "uk",
  "nl",
  "sv",
  "ms",
  "fil",
]

export const POPULAR_TRANSLATE_LANGUAGES = POPULAR_TRANSLATE_CODES.map(
  (code) => TRANSLATE_LANGUAGES.find((l) => l.code === code)!,
).filter(Boolean)

export const LANGUAGE_CODES = TRANSLATE_LANGUAGES.map((l) => l.code)

export interface LanguageOption {
  code: string
  name: string
  curated?: boolean
}

let cachedOptions: LanguageOption[] | null = null

export function getLanguageOptions(): LanguageOption[] {
  if (cachedOptions) return cachedOptions

  let displayNames: Intl.DisplayNames | null = null
  try {
    displayNames = new Intl.DisplayNames(undefined, { type: "language" })
  } catch {
    displayNames = null
  }

  const resolveLabel = (code: string, fallback: string): string => {
    if (displayNames) {
      try {
        const resolved = displayNames.of(code)
        if (resolved && resolved !== code) return resolved
      } catch {}
    }
    return fallback
  }

  const seen = new Set<string>()
  const list: LanguageOption[] = []

  for (const code of CURATED_LANGUAGE_CODES) {
    seen.add(code)
    const fallback = TRANSLATE_LANGUAGES.find((l) => l.code === code)?.name ?? EXTRA_LANGUAGE_NAMES.get(code) ?? code
    const label = resolveLabel(code, fallback)
    list.push({ code, name: `${label} (${code})`, curated: true })
  }

  for (const item of TRANSLATE_LANGUAGES) {
    if (seen.has(item.code)) continue
    seen.add(item.code)
    const label = resolveLabel(item.code, item.name)
    list.push({ code: item.code, name: `${label} (${item.code})` })
  }

  for (const [code, fallback] of EXTRA_LANGUAGE_NAMES.entries()) {
    if (seen.has(code)) continue
    seen.add(code)
    const label = resolveLabel(code, fallback)
    list.push({ code, name: `${label} (${code})` })
  }

  cachedOptions = list
  return cachedOptions
}

export function formatLanguageName(code: string): string {
  const item = TRANSLATE_LANGUAGES.find(
    (l) =>
      l.code.toLowerCase() === code.toLowerCase() ||
      l.code.toLowerCase().split("-")[0] === code.toLowerCase().split("-")[0],
  )
  if (item) {
    return item.native && item.native !== item.name ? `${item.name} (${item.native})` : item.name
  }
  const extra = EXTRA_LANGUAGE_NAMES.get(code.toLowerCase())
  if (extra) return extra
  try {
    const displayNames = new Intl.DisplayNames(undefined, { type: "language" })
    const resolved = displayNames.of(code)
    if (resolved) return resolved
  } catch {}
  return code.toUpperCase()
}

const COVERED_BY_CURATED: Record<string, string> = { nb: "no", nn: "no" }

export function matchLanguageOption(lang: string): string | null {
  const clean = lang.trim()
  if (!clean) return null
  const lower = clean.toLowerCase()
  const exactCurated = CURATED_LANGUAGE_CODES.find((c) => c.toLowerCase() === lower)
  if (exactCurated) return exactCurated
  if (/^zh[-_](tw|hk|mo|hant)/i.test(clean)) return "zh-Hant"
  const base = lower.split(/[-_]/)[0]
  if (COVERED_BY_CURATED[base]) return COVERED_BY_CURATED[base]
  const baseCurated = CURATED_LANGUAGE_CODES.find((c) => c.toLowerCase() === base)
  if (baseCurated) return baseCurated
  if (EXTRA_LANGUAGE_NAMES.has(base)) return base
  const trans = TRANSLATE_LANGUAGES.find((l) => l.code.toLowerCase() === lower || l.code.toLowerCase() === base)
  return trans ? trans.code : null
}

export function detectLyricsLanguage(text: string): string | null {
  // Check TTML xml:lang or lang attribute on root <tt>
  const ttmlMatch = text.match(/<(?:[\w.-]+:)?tt\b[^>]*\b(?:xml:)?lang\s*=\s*["']([^"']+)["']/i)
  if (ttmlMatch) {
    const matched = matchLanguageOption(ttmlMatch[1])
    if (matched) return matched
  }

  // Detect script (Japanese, Korean, Chinese, Cyrillic, Arabic, Hebrew, Thai, Hindi, Bengali)
  if (/[\u3040-\u30ff\u31f0-\u31ff]/.test(text)) return "ja"
  if (/[\uac00-\ud7af\u1100-\u11ff]/.test(text)) return "ko"
  if (/[\u4e00-\u9fff]/.test(text)) return "zh"
  if (/[\u0400-\u04ff]/.test(text)) return "ru"
  if (/[\u0600-\u06ff]/.test(text)) return "ar"
  if (/[\u0590-\u05ff]/.test(text)) return "he"
  if (/[\u0e00-\u0e7f]/.test(text)) return "th"
  if (/[\u0900-\u097f]/.test(text)) return "hi"
  if (/[\u0980-\u09ff]/.test(text)) return "bn"

  return null
}
