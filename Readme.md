# depicture
A game about drawing what you read, then saying what you see.

Each player is given a distinct prompt, which they attempt to depict in a drawing. Then, the drawings are shifted between players, who now have to guess what the prompt was. This continues until every player has contributed to every story, at which point the stories are all revealed, and everyone can see just how badly the whole thing ended up.

# Where can I play?
## Official site
You can access the game [here](https://depicture.itsalxl.com); play with your friends!
## Compile from source
You can compile and run your own server from the source code; all you strictly need is [NodeJS](https://nodejs.org/). Although you could download the source files manually off of GitHub, it's probably best if you use [git](https://git-scm.com/).

Once you have the code, execute the following commands within the project root to start the server.
```sh
# Get dependencies (only needed the first time)
npm install

# Run server
node Server/depicture.js
```
By default, depicture uses port 6465. Use your browser to connect to port 6465 of the server (e.g. `localhost:6465`), and you're all set!

## In a Docker container
Yep, depicture is [Dockerized](https://www.docker.com/). There is a Docker image available for the latest stable build of depicture at [alxl/depicture](https://hub.docker.com/repository/docker/alxl/depicture) on Docker Hub.
```sh
# Run a Docker container of depicture
docker run alxl/depicture

# Run a Docker container of depicture that uses port 8080 instead of 6465
docker run -p 8080:6465 alxl/depicture
```