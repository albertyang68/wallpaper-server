# wallpaper-server
A simple node app running in the server intended to pull sources from reddit and put into a folder.

## Usage
1. Rename `config-default.json` to `config.json`
2. Create a reddit script app from (https://www.reddit.com/prefs/apps)
    * `redirect uri` - any url, like the one in picture
![Image](https://camo.githubusercontent.com/d53f92cd85d1279a239444acee25179e8e6d8bb5/687474703a2f2f692e696d6775722e636f6d2f65326b4f5231612e706e67)
3. Fill `reddit.user` with self credentials
    * `clientId` - Line under `personal use script`
    * `clientSecret` - Red line
4. Run `search.js`

## Change log
Version 0.1: (plan) 
* Fetch wallpaper from reddit/imgur every x min/hour
* Put downloaded wallpaper into sepcific folder

Version 0.2: (plan)
* Web interface, ability to change source query and fetch time

## Folder structure
wallpaper-server
  * reddit
      * 1920x1080
        * normal
        * nsfw
      * 2560x1440
        * normal
        * nsfw
      * large
        * normal
        * nsfw
      * other
        * normal
        * nsfw

## Known bug
* ~~Need to delete all existing folder if config.subReddits is modified~~(Fixed)
