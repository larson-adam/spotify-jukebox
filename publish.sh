cd lambda
cd createParty
del .\createParty.zip
7z a -r index.zip .

aws lambda update-function-code --function-name "createParty" --zip-file fileb://.//index.zip