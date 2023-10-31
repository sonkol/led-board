# Odjezdová tabule pro LED

Tato aplikace je určená jako technologická demonstrace pro odjezdové tabule na LED panelu o rozměrech 384 × 128 bodů.

# Instalace
K provozu aplikace je potřeba Golemio API klíč, který se vloží do souboru key.js. Tento klíč se získá na https://api.golemio.cz/api-keys/. Pak lze otevřít index.html. Nakonec je potřeba zadat zastávku pod kódem `aswIds=`.

## Parametry
Tabule podporuje níže popsanou podmnožinu parametrů, které se zapisují do URL. Dokumentace k parametrům je na https://api.golemio.cz/v2/pid/docs/openapi/#/%F0%9F%9A%8F%20PID%20Departure%20Boards.

| Parametr     | Výchozí hodnota  | Význam                                                                                                                  |
|--------------|------------------|-------------------------------------------------------------------------------------------------------------------------|
|`airCondition`|`true`            | Zapíná indikaci klimatizace                                                                                             |
|`aswIds`      |`539_1`           | Zobrazovaná zastávka dle číselníku ASW. Výchozí je Národní třída.                                                       |
|`displayWidth`|`384`             | Nastaví šířku obrazovky. Platné hodnoty mezi `370`–`384` px                                                             |
|`filter`      |`routeHeadingOnce`| Filtruje zobrazení linek                                                                                                |
|`limit`       |`5`               | Počet zobrazených odjezdů. Pro zobrazení většího počtu odjezdů je potřeba zmenšit písmo, jinak se nevejde na obrazovku. |
|`skip`        |`atStop`          | Nebude zobrazovat spoje hlásící se v zastávce                                                                           |
|`minutesAfter`|`99`              | Omezí zobrazení odjezdů do počtu minut                                                                                  |

Příklad výchozí URL se všemi parametry: index.html?airCondition=true&aswIds=539_1&filter=routeHeadingOnce&limit=5&skip=atStop&minutesAfter=99

## Funkce
Aplikace je určená pro zobrazování tabulí na LED panelech, a proto podporuje jen minimální podmnožinu požadovaných funkcí.
Podpora je hotová pro 
* Zobrazení celoplošného informačního textu
* Zobrazování řádkového informačního textu
* Náhradní zpráva při poruše
* Čtení pro nevidomé
* Dynamické zvětšování textu na základě počtu řádků
* Přidat automaticky kód stanoviště v případě více ID

Zatím není podporováno:
* Zobrazení celoplošného střídavého informačního textu
* Přednastavené zastávky
