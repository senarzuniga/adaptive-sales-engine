import urllib.request, time
url='http://localhost:8512'
for i in range(10):
    try:
        r=urllib.request.urlopen(url, timeout=2)
        print('status', r.getcode())
        break
    except Exception as e:
        print('try', i, 'failed', e)
        time.sleep(1)
