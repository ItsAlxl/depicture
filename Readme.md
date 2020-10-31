# depicture
A game about drawing what you read, then saying what you see.

Each player is given a distinct prompt, which they attempt to depict in a drawing. Then, the drawings are passed between players, who now have to guess what the prompt was that inspired the drawing of another player. The guesses are then passed along, and now everyone has to draw based on that prompt. This continues until every player has contributed to every story, at which point the stories are all revealed, and everyone can see just how badly the whole thing ended up.

# Where can I play?
## Online
You can access the game [here](https://depicture.itsalxl.com); play with your friends!
## Compile from source
You can compile and run your own server from the source code; all you strictly need is [NodeJS](https://nodejs.org/). You can get the source code from [GitHub](https://github.com/ItsAlxl/depicture).

Once you have the code, execute the following commands within the project root to start the server.
```sh
# Get dependencies (only needed the first time)
npm install

# Run server
npm start
```
By default, depicture uses port 6465. Use your browser to connect to port 6465 of the server (e.g. `localhost:6465`), and you're all set!

## In a Docker container
There is a Docker image available for depicture at [alxl/depicture](https://hub.docker.com/repository/docker/alxl/depicture) on Docker Hub.

Running a Docker container of depicture open on port 80:

```sh
docker run -p 80:6465 alxl/depicture:stable
```

## Custom prompts
depicture gets its prompts from an API that is specified by the host of a room. The default one can be found [here](https://itsalxl.com/depicture-words/). You can set up your own using the companion project, [PHP Line Spitter](https://github.com/ItsAlxl/PHP-Line-Spitter). Supply your prompt lists as `.txt` files in the `lists/` folder of the PHP Line Spitter. Then, just provide your API root as the `Prompt Source` when hosting a room.