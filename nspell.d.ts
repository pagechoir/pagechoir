declare module "nspell" {
  type Spell = {
    correct(word: string): boolean;
    suggest(word: string): string[];
  };
  function nspell(affix: string, dictionary: string): Spell;
  export default nspell;
}
