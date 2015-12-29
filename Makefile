ALL=webroot/js/realtimeform.js

all: $(ALL)

webroot/js/realtimeform.js: webroot/ts/realtimeform.ts
	tsc -m commonjs -out webroot/js/realtimeform.js -t ES5 webroot/ts/realtimeform.ts
