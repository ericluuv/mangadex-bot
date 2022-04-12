# mangadex-bot
Discord bot that can track mangas via the MangaDex API.

Hosted on Heroku, using postgreSQL for the database.

General idea is to have a set channel for every server, create a list for that server, and add all mangas to that row.
From there, keep another table of users that follow a manga, and specifically use Discord mentions when an update comes along.

Credits go to https://github.com/sanakanw/mangadex-webhook for the idea and baseline code of tracking mangas through discord.
Credits also go to https://api.mangadex.org/docs/ for their API usage. As per the Acceptable use policy, Scanlation Group names are posted with every chapter.