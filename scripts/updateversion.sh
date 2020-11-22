cat package.json \
    | jq --indent 4 '.version = .version + "_'$BUILD_BUILDNUMBER'"' \
    > package.json.tmp \
    && mv package.json.tmp package.json
