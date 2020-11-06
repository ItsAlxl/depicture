if [ -z $1 ]; then
    echo "Enter Docker Hub username"
    read username
    echo "Enter tag (blank for latest)"
    read tag
else
    username=$1
    tag=$2
fi
if [ -z $tag ]; then
    tag="latest"
fi
docker build -t $username/depicture:$tag $(dirname $0)
docker push $username/depicture:$tag