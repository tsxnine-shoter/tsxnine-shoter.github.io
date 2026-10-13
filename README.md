# Strona twórcy klipów – uruchomienie lokalne (localhost)

## Co zrobić (jednorazowo)
1. Wrzuć swoje zdjęcie jako `tsx.png` do tego folderu (obok `index.html`). Nazwa małymi literami.
2. Zainstaluj Node.js (https://nodejs.org, wersja LTS).
3. Żeby ściągały się klipy z TikToka: zainstaluj `yt-dlp` (https://github.com/yt-dlp/yt-dlp/releases – plik yt-dlp.exe wrzuć do folderu, który jest w PATH, albo do tego folderu projektu).
4. Otwórz `site.config.json` i uzupełnij `nick` oraz `discordTag`/linki, jeśli ich używasz. Puste linki są na stronie ukryte (YouTube i Instagram możesz dodać później).

## Start
- Windows: dwuklik na `start.bat`
- Mac/Linux: `./start.sh`
Potem wejdź na http://localhost:8080 . Klipy odświeżają się same przy starcie i co 30 minut.
Nie otwieraj `index.html` dwuklikiem – wtedy przeglądarka blokuje dane.

## Instagram
Wymaga konta Business/Creator i tokena Graph API (`IG_TOKEN`) – patrz ustawienia `sources.instagramEnabled`. Bez tego Instagram jest pomijany.

## Publikacja na GitHub Pages (opcjonalnie, później)
Wrzuć folder do repozytorium, włącz Pages (branch `main`, root) i uruchom workflow „Aktualizuj klipy” (Actions). Na GitHubie TikTok wymaga adresu RSS z RSSHub w `sources.tiktokRssUrl` (yt-dlp działa tylko lokalnie).
