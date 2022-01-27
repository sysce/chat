# Chatutils
Alternative embeddable front-end for your Discord server

## Setup

1. Download the [Github repo](https://github.com/sysce/chat/archive/master.zip)

2. Extract the zip file to a memorable place (eg. your desktop)

3. Visit the [Discord Developer Portal](https://discord.com/developers/applications), signin, and `press New Application`

4. Set your application name to whatever you desire, this will not matter later

5. Once you are at the bot page, to the left you will see a button labelled `Bot`, click this and press `Add Bot` to the right then press `Yes, do it!` to confirm

6. Scroll down to the area where it says `Token Click to reveal token` and press the blue `Copy` button below it

7. In a text editor such as notepad or gedit (this does not matter, just has to be an editor) open up the config.json from the zip you extracted to your desktop

8. Inside config.json, remove the text that says `insert bot token here` and in its place, paste from your clipboard as the copy button on the earlier page should have copied your token DO NOT SHARE THIS TOKEN 

9. In the config, replace `insertContact@domain.tld` with a contact email that you will use for apis and services that need it (optional)

10. Save then close your text editor and go back to the [Discord Developer Portal](https://discord.com/developers/applications) page and go to your bots `OAuth2` tab and and under the `Client ID` text it will show a series of numbers (eg. 923819283912931299)

11. Once you have located this, press the blue `Copy` button below it

12. Visit the [invite URL generator](https://discordapi.com/permissions.html#537136192) and then paste from your clipboard your client ID that you had just now copied into the input box that says `Client ID`

13. A new link should have appeared generated at the bottom of the screen(you may have to scroll down), click on this link and choose a server to invite your bot to

14. Install NodeJS and NPM from [here](https://nodejs.org/en/download/)

15. Now once you have invited your bot, locate your terminal,

<br/>Windows: Press Windows + R. Then type cmd into the window that pops up.<br/>
Linux: Press CTRL+ALT+T<br/>
MacOS: Launchpad => terminal<br/><br/>

16. In your terminal use `cd` to navigate to your desktop, then to the folder you extracted the zip file downloaded earlier

17. In your terminal once again, type in `npm install` then the installation of our packages and dependencies will begin installing (should take a few seconds)

18. Now that the installation is complete, type in `node app` or `npm start` and if all has gone well, your bot should be online

19. If you have added yourself as a helper or staff in your server or you are the server owner, you may type in `_setchannel` on your Discord server in a channel then Chatutils will begin configuring itself.

Congrats, you successfully setup Chatutils.
You can see your thing running at http://localhost:8080/
