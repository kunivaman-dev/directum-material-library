#!/bin/sh

case "$1" in
  *Username*)
    printf '%s\n' 'oauth2'
    ;;
  *Password*)
    security find-generic-password \
      -a directum-design-materials \
      -s gitlabozrrx.directum.ru \
      -w
    ;;
esac
