import {transformSync} from '@babel/core';
import path from 'node:path';
/** Localize rendered text at build time without changing stored content or event values. */
export default function localization(root) {
  return {name:'godly-kids-localized-text',enforce:'pre',transform(code,id){
    const file=id.split('?')[0];
    if(!/\.[jt]sx$/.test(file)||file.includes('node_modules')||file.includes('/localization/')||file.includes('/context/')||file.includes('/components/language/'))return null;
    let changed=false; let elements=false;
    const game=file.includes('/homeworld/src/');
    const result=transformSync(code,{filename:file,configFile:false,babelrc:false,sourceMaps:true,parserOpts:{plugins:['jsx',...(file.endsWith('.tsx')?['typescript']:[])]},plugins:[({types:t})=>({visitor:{
      JSXElement:{exit(p){
        const opening=p.node.openingElement;
        const tag=opening.name.name;
        if(opening.attributes.some(a=>a.name?.name==='data-no-localize'))return;
        if(!tag || !/^[a-z]/.test(tag) || !opening.attributes.some(a=>['aria-label','title','placeholder','alt'].includes(a.name?.name)))return;
        elements=true;changed=true;
        opening.name=t.jsxIdentifier('GKLocalizedElement');
        opening.attributes.unshift(t.jsxAttribute(t.jsxIdentifier('as'),t.stringLiteral(tag)));
        if(p.node.closingElement)p.node.closingElement.name=t.jsxIdentifier('GKLocalizedElement');
      }},
      JSXText(p){
        const text=t.react.buildChildren({children:[p.node]})[0]?.value || '';
        if(!/[A-Za-z]/.test(text))return;
        const parent=p.parentPath.node;const tag=parent.openingElement?.name?.name;
        if(['script','style','textarea','option','title'].includes(tag))return;
        changed=true;p.replaceWith(t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('GKLocalizedText'),[t.jsxAttribute(t.jsxIdentifier('value'),t.jsxExpressionContainer(t.stringLiteral(text)))],true),null,[],true));p.skip();
      },
      JSXExpressionContainer(p){
        if(!p.parentPath.isJSXElement()&&!p.parentPath.isJSXFragment())return;
        const e=p.node.expression;if(t.isJSXEmptyExpression(e))return;
        const raw=code.slice(e.start,e.end);
        if (raw.includes('<')) return;
        // User-authored content and existing translation calls stay untouched.
        if(!game && /\b(name|email|password|prayer|chat|transcript|message|t|translatedText|translatedTexts|reply)\b/i.test(raw))return;
        if(game && /^(name|.*resident.*\.name|.*character.*\.name|.*prayer\.name)$/i.test(raw.trim()))return;
        // Translate only textual data fields and literal choices, never arbitrary render trees.
        if(!game && !(t.isIdentifier(e) && /^(title|description|subtitle|label|hint|toast|q|bubble|blurb|note)$/.test(e.name)) && !(t.isStringLiteral(e)||t.isTemplateLiteral(e)||t.isConditionalExpression(e)||(/\.(title|description|subtitle|verse|status|label|hint|text)\b/.test(raw)&&!raw.includes('('))))return;
        changed=true;p.replaceWith(t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('GKLocalizedText'),[t.jsxAttribute(t.jsxIdentifier('value'),t.jsxExpressionContainer(e))],true),null,[],true));p.skip();
      },
      Program:{exit(p){if(changed)p.unshiftContainer('body',t.importDeclaration([t.importDefaultSpecifier(t.identifier('GKLocalizedText')), ...(elements?[t.importSpecifier(t.identifier('GKLocalizedElement'),t.identifier('LocalizedElement'))]:[])],t.stringLiteral(path.resolve(root,'localization/LocalizedText.tsx'))));}}
    }})]});
    return changed?{code:result.code,map:result.map}:null;
  }};
}
