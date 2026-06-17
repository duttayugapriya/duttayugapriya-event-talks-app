import os
import re
import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
cache_data = None
cache_time = None

def fetch_and_parse_feed():
    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        
        # Parse XML from bytes to support encoding headers properly
        root = ET.fromstring(response.content)
        ns = {'ns': 'http://www.w3.org/2005/Atom'}
        
        entries = []
        for entry_el in root.findall('ns:entry', ns):
            title_el = entry_el.find('ns:title', ns)
            updated_el = entry_el.find('ns:updated', ns)
            link_el = entry_el.find('ns:link', ns)
            content_el = entry_el.find('ns:content', ns)
            
            date_str = title_el.text if title_el is not None else "Unknown Date"
            updated_val = updated_el.text if updated_el is not None else ""
            link_href = ""
            if link_el is not None:
                link_href = link_el.attrib.get('href', '')
            content_html = content_el.text if content_el is not None else ""
            
            # Extract individual updates using <h3> tags
            pattern = re.compile(r'<h3>(.*?)</h3>\s*(.*?)(?=\s*<h3>|$)', re.DOTALL)
            matches = pattern.findall(content_html)
            
            entry_updates = []
            if matches:
                for idx, (update_type, desc_html) in enumerate(matches):
                    desc_html = desc_html.strip()
                    update_type_str = update_type.strip()
                    # Generate a unique ID based on date, index, and type
                    clean_date = date_str.replace(' ', '_').replace(',', '')
                    update_id = f"{clean_date}_{idx}_{update_type_str.lower()}"
                    entry_updates.append({
                        'id': update_id,
                        'type': update_type_str,
                        'description': desc_html
                    })
            else:
                entry_updates.append({
                    'id': f"{date_str.replace(' ', '_').replace(',', '')}_0_general",
                    'type': 'General',
                    'description': content_html.strip()
                })
                
            entries.append({
                'date': date_str,
                'updated': updated_val,
                'link': link_href,
                'updates': entry_updates
            })
            
        return {'success': True, 'data': entries}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    global cache_data, cache_time
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    now = datetime.now()
    # Cache duration 5 minutes
    is_cache_expired = True
    if cache_time is not None:
        elapsed = (now - cache_time).total_seconds()
        if elapsed < 300:
            is_cache_expired = False
            
    if force_refresh or cache_data is None or is_cache_expired:
        result = fetch_and_parse_feed()
        if result['success']:
            cache_data = result['data']
            cache_time = now
            return jsonify({
                'success': True, 
                'data': cache_data, 
                'source': 'live', 
                'last_updated': cache_time.strftime("%I:%M:%S %p")
            })
        else:
            if cache_data is not None:
                # Return cached data if live fetch fails
                return jsonify({
                    'success': True, 
                    'data': cache_data, 
                    'source': 'cache', 
                    'warning': result['error'],
                    'last_updated': cache_time.strftime("%I:%M:%S %p")
                })
            return jsonify({'success': False, 'error': result['error']})
            
    return jsonify({
        'success': True, 
        'data': cache_data, 
        'source': 'cache',
        'last_updated': cache_time.strftime("%I:%M:%S %p")
    })

if __name__ == '__main__':
    # Standard local Flask server
    app.run(host='127.0.0.1', port=5000, debug=True)
