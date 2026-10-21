"""Reproducible import of the eight official PDFs. Never infer a missing key."""
import hashlib
import json
import re
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent

def tidy(text):
    return re.sub(r'\s+', ' ', text).strip()

def cleaned(text):
    lines = []
    for line in text.splitlines():
        s = line.strip()
        if not s or re.fullmatch(r'\d+', s):
            continue
        if re.match(r'(Dirección General|CONSEJERÍA|INFRAESTRUCTURAS|Comunidad|de Madrid|Test ID:|Página \d)', s):
            continue
        if re.match(r'(M[óÓ]dulo|MÓDULO)\s+[IVX]+\s*:', s):
            continue
        lines.append(s)
    return '\n'.join(lines)

def extract(path):
    reader = PdfReader(path)
    pages = [cleaned(page.extract_text()) for page in reader.pages]
    text = '\n'.join(pages)
    offsets, total = [], 0
    for page in pages:
        offsets.append(total)
        total += len(page) + 1
    sample = path.name.startswith('muestra')
    module = next((m for roman, m in [('iii',3), ('iv',4), ('ii',2), ('i',1)] if f'modulo_{roman}_' in path.name), None)
    pattern = r'(?m)^Pregunta:\s*' if sample else r'(?m)^(\d{1,2})\.\s*'
    starts = list(re.finditer(pattern, text))
    keys = list(re.finditer(r'(?:Respuesta correcta\s*:?\s*|^CORRECTA\s*:\s*)([a-dA-D])\b', text, re.I | re.M))
    if len(starts) != len(keys):
        raise ValueError(f'{path.name}: {len(starts)} questions but {len(keys)} keys')
    questions = []
    for i, match in enumerate(starts):
        n = i + 1 if sample else int(match.group(1))
        block = text[match.end(): starts[i+1].start() if i+1 < len(starts) else len(text)]
        key = re.search(r'(?:Respuesta correcta\s*:?\s*|^CORRECTA\s*:\s*)([a-dA-D])\b', block, re.I | re.M)
        if not key:
            raise ValueError(f'Missing key {path.name}:{n}')
        body = re.split(r'Referencia\s*:', block[:key.start()])[0]
        opts = list(re.finditer(r'(?m)^\s*([a-dA-D])[.)]\s*:?\s*', body))
        if [o.group(1).lower() for o in opts] != ['a','b','c','d']:
            raise ValueError(f'Invalid options {path.name}:{n}: {body}')
        title = tidy(body[:opts[0].start()])
        options = [{'id': o.group(1).lower(), 'text': tidy(body[o.end():opts[j+1].start() if j+1 < 4 else len(body)])} for j,o in enumerate(opts)]
        if not title or any(not o['text'] for o in options):
            raise ValueError(f'Empty text {path.name}:{n}')
        m = module or (1 if n <= 12 else 2 if n <= 30 else 3 if n <= 48 else 4)
        page = sum(match.start() >= offset for offset in offsets)
        fingerprint = hashlib.sha256(tidy(title + '|' + '|'.join(o['text'] for o in options)).encode()).hexdigest()[:16]
        questions.append({'id': 'of-' + fingerprint, 'module': m, 'text': title, 'options': options,
          'correct': key.group(1).lower(), 'official': True, 'sources': [{'file':path.name,'page':page,'number':n}],
          'difficulty': 3 if m == 4 or re.search(r'\b(no|excepto|incorrecta|infracci[oó]n|plazo)\b', title, re.I) else 2 if m in (2,3) else 1})
    if not sample and [q['sources'][0]['number'] for q in questions] != list(range(1,61)):
        raise ValueError(f'Incomplete official example: {path.name}')
    return questions, len(reader.pages)

def main():
    bank, examples, report = {}, [], []
    for path in sorted((ROOT/'temas').glob('*.pdf')):
        qs, pages = extract(path)
        ids = []
        for q in qs:
            if q['id'] in bank:
                existing = bank[q['id']]
                if existing['correct'] != q['correct']:
                    raise ValueError(f'Conflicting official keys: {q["text"]}')
                existing['sources'].extend(q['sources'])
            else:
                bank[q['id']] = q
            ids.append(q['id'])
        if path.name.startswith('ejemplo'):
            examples.append({'id':path.stem,'title':'Prueba oficial ' + path.stem.split('-')[-1].upper(),'questionIds':ids,'file':path.name})
        report.append({'file':path.name,'pages':pages,'questions':len(qs),'keys':len(qs),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    output = ROOT/'data'
    output.mkdir(exist_ok=True)
    (output/'questions.json').write_text(json.dumps(list(bank.values()),ensure_ascii=False,indent=2),encoding='utf8')
    (output/'examples.json').write_text(json.dumps(examples,ensure_ascii=False,indent=2),encoding='utf8')
    (output/'import-report.json').write_text(json.dumps({'sources':report,'totalOccurrences':sum(r['questions'] for r in report),'uniqueQuestions':len(bank),'modules':{str(m):sum(q['module']==m for q in bank.values()) for m in range(1,5)}},ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({'sources':report,'uniqueQuestions':len(bank)},ensure_ascii=False))

if __name__ == '__main__':
    main()

