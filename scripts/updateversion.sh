package_json="$(cat package.json | jq '.version = .version + "-'$BUILD_BUILDNUMBER'"')"
echo "$package_json" > package.json
