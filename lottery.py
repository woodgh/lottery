#!/usr/bin/python
#-*-coding:utf-8-*-
import bs4
import json
import requests
import urllib3
import time
import random

''' 로또 '''
def scrapLottery(round=None):
    url = 'https://www.dhlottery.co.kr/gameResult.do?method=byWin'

    if round is not None:
        url += '&drwNo={0}'.format(round)

    try:
        res = requests.get(url, verify=False, timeout=10)
    except Exception as e:
        return round, {}

    try:
        soup = bs4.BeautifulSoup(res.content, features="html.parser")
    except Exception as e:
        return round, {}

    try:
        res = soup.find('div', {'class':'win_result'}).find('strong')
    except Exception as e:
        return round, {}
    else:
        round = int(res.text.replace('회', ''))

    try:
        res = soup.find('div', {'class':'num win'}).find_all('span', {'class':'ball_645'})
    except Exception as e:
        return round, {}
    else:
        numbers = [int(win.text) for win in res]

    try:
        res = soup.find('div', {'class':'num bonus'}).find('span', {'class':'ball_645'})
    except Exception as e:
        return round, {}
    else:
        bonus = int(res.text)

    try:
        res = soup.find('table', {'class':'tbl_data tbl_data_col'}).find_all('td', {'class':'tar'})
    except Exception as e:
        return round, {}
    
    prize = dict()
    for winner in range(5):
        total = int(res[winner * 2].text.replace(',', '').replace('원', ''))
        person = int(res[winner * 2 + 1].text.replace(',', '').replace('원', ''))

        prize[winner + 1] = {
            'total':total,
            'person':person,
            'count': total / person if total > 0 else 0
        }

    return round, json.loads(
        json.dumps({
            'numbers':numbers,
            'bonus':bonus,
            'avg':sum(numbers) / len(numbers),
            'prize':prize
        })
    )

class App:
    def __init__(self):
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        with open('static/lottery.json', 'r') as f:
            self.lotteryData = json.load(f)

    def __saveData__(self):
        with open('static/lottery.json', 'w') as f:
            json.dump(self.lotteryData, f, indent=4)

    def run(self):
        lastRound, lastResult = scrapLottery()
        
        for r in range(1, lastRound + 1):
            time.sleep(3)

            if str(r) in self.lotteryData:
                continue
            
            try:
                round, result = scrapLottery(r)
            except Exception as e:
                print("Error fetching data for round {r}: {e}")
            else:
                self.lotteryData[round] = result

            print("Round %d data fetched successfully." % r)

        self.__saveData__()

''' main '''
if __name__ == '__main__':
    app = App()
    app.run()
