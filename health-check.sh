#!/bin/bash

KEYSARRAY=()
URLSARRAY=()

urlsConfig="$(pwd)/urls.cfg"
while read -r line
do
  key="${line%%=*}" # Extract everything before the first '=' as the key
  url="${line#*=}"  # Extract everything after the first '=' as the URL
  KEYSARRAY+=("$key")
  URLSARRAY+=("$url")
done < "$urlsConfig"

for (( index=0; index < ${#KEYSARRAY[@]}; index++))
do
  key="${KEYSARRAY[index]}"
  url="${URLSARRAY[index]}"

  for i in 1 2 3 4; 
  do
    response=$(curl --write-out '%{http_code}' --silent --output /dev/null "$url")
    if [ "$response" -eq 200 ] || [ "$response" -eq 202 ] || [ "$response" -eq 301 ] || [ "$response" -eq 302 ] || [ "$response" -eq 307 ]; then
      result="success"
    else
      result="failed"
    fi
    if [ "$result" = "success" ]; then
      break
    fi
    sleep 5
  done
  dateTime=$(date +'%Y-%m-%d %H:%M')
  echo "$key,$dateTime,$result"
done