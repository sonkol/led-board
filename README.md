# Odjezdová tabule pro LED
Tato aplikace je určená pro zobrazování odjezdů na zastávkových tabulích o rozměrech 370–384 × 128 bodů.

# Instalace
Všechny soubory se rozbalí do složky. K provozu aplikace je potřeba Golemio API klíč, který se vloží do souboru key.js. Tento klíč se získá na https://api.golemio.cz/api-keys/. Pak je možné získat odjezdy ze zastávky pod kódem `aswIds=`.
V případě použití presetu se autentizace provádí v rámci presetu.

## Parametry
Tabule podporuje níže popsanou podmnožinu parametrů, které se zapisují do URL. Dokumentace k parametrům je na https://api.golemio.cz/v2/pid/docs/openapi/#/%F0%9F%9A%8F%20PID%20Departure%20Boards.

| Parametr     | Výchozí hodnota  | Význam                                                                                                                                        |
|--------------|------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|
|`airCondition`|`true`            | Zapíná indikaci klimatizace. `true` nebo `false`.                                                                                             |
|`aswIds`      |                  | Zobrazovaná zastávka dle číselníku ASW. Přípustné je zadat celý uzel nebo jedno stanoviště (oddělené podtržítkem).                            |
|`displayWidth`|`384`             | Nastaví šířku obrazovky. Platné hodnoty mezi `370`–`384` px.                                                                                  |
|`filter`      |`routeHeadingOnce`| Filtruje zobrazení linek. Platné hodnoty jako v položce *filter* z dokumentace Golemio API.                                                   |
|`limit`       |`5`               | Počet zobrazených odjezdů. Platné hodnoty `1`–`5`. Doporučeno ponechat 5, písmo zůstane vždy stejně velké.                                    |
|`minutesAfter`|`99`              | Omezí zobrazení odjezdů do počtu minut. Platné hodnoty `0`–`1440`.                                                                            |
|`preset`      |                  | Kód přednastavené zastávky. Vylučuje se s ostatními parametry mimo `displayWidth`.                                                            |
|`skip`        |`atStop`          | Nebude zobrazovat spoje hlásící se v zastávce. Platné hodnoty jako v položce *skip* z dokumentace Golemio API.                                |

Příklad URL se všemi parametry: `index.html?airCondition=true&aswIds=539_1&displayWidth=384&filter=routeHeadingOnce&limit=5&minutesAfter=99&skip=atStop`

## Funkce
Aplikace je určená pro zobrazování tabulí na LED panelech, a proto podporuje jen potřebnou podmnožinu zobrazovacích funkcí. Aplikaci stačí spustit a sama se bude dotazovat na odjezdy. Aplikace se v případě pádu nebo aktualizace sama nenačte, to je věcí content managementu. 

Velikost čísla linky a konečné zastávky se přizpůsobí volnému místu. Základní délka čísla linky je na 4 znaky. 

### Automatické zobrazování sloupce s kódem zastávky
Pokud jsou do tabule posílány odjezdy z více stanovišť, zobrazí se sloupec s kódem stanoviště.

### Informační texty
Tabule zobrazuje řádkový a celoplošný informační text. Pokud se informační text nevejde na obrazovku, je animovaný.

### Čtení pro nevidomé
Čtení pro nevidomé bylo zakomentováno.
~Stisknutím tlačítka `Num1` se přečte název zastávky. Stisknutím tlačítka `Num6` se přečte seznam odjezdů z tabule. Tlačítko `Num5` zastaví čtení. Opětovné stisknutí `Num5` čtení obnoví. Pokud jsou přítomny infotexty, přečtou se před odjezdy. Pokud je tabule prázdná, ohlásí se, že není plánovaný žádný odjezd.~

### Ostatní stavy
Pokud tabule nezískala po stanovenou dobu data, zobrazí se zpráva, že tabule je mimo provoz.

Pokud kód zastávky vrací HTTP 404 (buď zastávka skutečně neexistuje nebo existovala, a byl zrušen provoz), zobrazí se, že není naplánovaný žádný odjezd.

## Soubory
* README.md – tento soubor
* style.css – stylopis
  * index.html – hlavní stránka
* Písma
  * lato-regular.woff2 – náhradní svobodné písmo
  * prague_citizen_light.woff2 – licencované písmo – není součástí základní verze
  * prague_citizen_semibold.woff2 – licencované písmo – není součástí základní verze¨
* Obrázky
  * accessible.svg – symbol přístupnosti pro nízkopodlažní spoje
  * hatch.svg – symbol šrafy
  * snowflake.svg – symbol vločky pro klimatizované spoje
  * warning.svg – výkřičník k informačním textům
* Skripty
  * key.js – soubor s API klíčem. Při používání presetů není potřeba.
  * led-board.js – skript, který oživuje stránku
* Zvuky
  * end.mp3 – zvuk konce relace pro text-to-speech
  * start.mp3 – zvuk začátku relace pro text-to-speech
