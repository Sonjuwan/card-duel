import {createContext,useContext} from 'react';
import type {Card} from '../../../packages/engine/src/index.ts';
import {REFERENCE_CARDS} from './reference-art-data.ts';

/** Names can be switched without changing the underlying card id or art. */
export const ClassicNamesContext=createContext(false);
export function displayCardName(card:Card,classic:boolean):string{
  return classic?(REFERENCE_CARDS[card.id]?.name??card.name):card.name;
}
export function useCardName(card:Card):string{return displayCardName(card,useContext(ClassicNamesContext));}
