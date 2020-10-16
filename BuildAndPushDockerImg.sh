echo "Enter Docker Hub username"
read username
docker build -t $username/depicture:latest $(dirname $0)
docker push $username/depicture:latest