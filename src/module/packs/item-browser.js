/**
 * ItemBrowserSFRPG forked from ItemBrowserPF2e by Felix Miller aka syl3r86
 * @author Fabien Dey
 * @version 0.1
 */
import { packLoader } from './pack-loader.js';

export class ItemBrowserSFRPG extends Application {
  static get defaultOptions() {
    const options = super.defaultOptions;
    options.template = 'systems/sfrpg/templates/packs/item-browser.html';
    options.classes = options.classes.concat(['sfrpg', 'item-browser-window']);
    options.title = game.i18n.format("SFRPG.Browsers.ItemBrowser.Title");
    options.width = 800;
    options.height = 700;
    return options;
  }

  activateListeners(html) {
    this.resetFilters(html);
    html.on('click', '.clear-filters', ev => {
      this.resetFilters(html);
      this.filterItems(html.find('li'));
    }); // show item card

    html.on('click', '.item-edit', ev => {
      const itemId = $(ev.currentTarget).parents('.item').attr('data-entry-id');
      const itemCategory = $(ev.currentTarget).parents('.item').attr('data-item-category');
      const items = this[itemCategory];
      let item = items.find(x => x._id === itemId);
      const pack = game.packs.find(p => p.collection === item.compendium);
      item = pack.getEntity(itemId).then(item => {
        item.sheet.render(true);
      });
    }); //show actor card

    html.on('click', '.actor-edit', ev => {
      const actorId = $(ev.currentTarget).parents('.item').attr('data-entry-id');
      const actorCategory = $(ev.currentTarget).parents('.item').attr('data-actor-category');
      const actors = this[actorCategory];
      let actor = actors[actorId];
      const pack = game.packs.find(p => p.collection === actor.compendium);
      actor = pack.getEntity(actorId).then(npc => {
        npc.sheet.render(true);
      });
    }); // make draggable

    html.find('.draggable').each((i, li) => {
      li.setAttribute('draggable', true);
      li.addEventListener('dragstart', event => {
        const packName = li.getAttribute('data-entry-compendium');
        const pack = game.packs.find(p => p.collection === packName);

        if (!pack) {
          event.preventDefault();
          return false;
        }

        event.dataTransfer.setData('text/plain', JSON.stringify({
          type: pack.entity,
          pack: pack.collection,
          id: li.getAttribute('data-entry-id')
        }));
      }, false);
    }); // toggle visibility of filter containers

    html.on('click', '.filtercontainer h3', ev => {
      $(ev.target.nextElementSibling).toggle(100);
    }); // toggle hints

    html.on('mousedown', 'input[name=textFilter]', ev => {
      if (event.which == 3) {
        $(html.find('.hint')).toggle(100);
      }
    }); // sort item list

    html.on('change', 'select[name=sortorder]', ev => {
      const itemList = html.find('li');
      const sortedList = this.sortItems(itemList, ev.target.value);

      const ol = $(html.find('ul'));
      ol[0].innerHTML = [];
      for (const element of sortedList) {
        ol[0].append(element);
      }
    }); // activating or deactivating filters

    html.on('change paste', 'input[name=textFilter]', ev => {
      this.sorters.text = ev.target.value;
      this.filterItems(html.find('li'));
    });
    html.on('change', '#timefilter select', ev => {
      this.sorters.castingtime = ev.target.value;
      this.filterItems(html.find('li'));
    });

    html.on('click', 'input[type=checkbox]', ev => {
      const filterSplit = ev.target.name.split(/-/);
      const filterType = filterSplit[0];
      const filterTarget = filterSplit[1];
      const filterValue = ev.target.checked;

      this.filters[filterType].activeFilters = this.filters[filterType].activeFilters || [];
      if (filterValue) {
        if (!this.filters[filterType].activeFilters.find(x => x === filterTarget)) {
          this.filters[filterType].activeFilters.push(filterTarget);
        }
      } else {
        this.filters[filterType].activeFilters = this.filters[filterType].activeFilters.filter(x => x !== filterTarget);
      }

      this.filterItems(html.find('li'));
    });
  }

  async getData() {
    if (this.items == undefined || this.forceReload == true) {
      // spells will be stored locally to not require full loading each time the browser is opened
      this.items = await this.loadItems();
      this.forceReload = false;
      this.sortingMethods = this.getSortingMethods();
      this.filters = this.getFilters();
    }

    const data = {};
    data.items = this.items;
    data.sortingMethods = this.sortingMethods;
    data.filters = this.filters;
    return data;
  }

  getSortingMethods() {
      let sortingMethods = {
        name: {
          name: game.i18n.format("SFRPG.Browsers.ItemBrowser.BrowserSortMethodName"),
          selected: true,
          method: this._sortByName
        }
      };
      return sortingMethods;
  }

  _sortByName(elementA, elementB) {
    const aName = $(elementA).find('.item-name a')[0].innerHTML;
    const bName = $(elementB).find('.item-name a')[0].innerHTML;

    if (aName < bName) return -1;
    if (aName > bName) return 1;
    return 0;
  }

  getFilters() {
    return {};
  }

  allowedItem(item) {
    return true;
  }

  async loadItems() {
    console.log('SFRPG | Compendium Browser | Started loading items');
    const items = [];

    for await (const {pack, content} of packLoader.loadPacks('Item', this._loadedPacks)) {
      console.log(`SFRPG | Compendium Browser | ${pack.metadata.label} - ${content.length} entries found`);

      for (let item of content) {
        item = item.data;
        item.compendium = pack.collection;

        if (this.allowedItem(item)) {
          items.push(item);
        }
      }
    }

    console.log('SFRPG | Compendium Browser | Finished loading items');
    return items;
  }

  sortItems(list, sortType) {
    list.sort(this.sortingMethods[sortType].method);
    return list;
  }

  async filterItems(li) {
    let counter = 0;
    li.hide();

    for (const item of li) {
      if (this.getFilterResult(item)) {
        $(item).show();

        if (++counter % 20 === 0) {
          // Yield to the browser to render what it has
          await new Promise(r => setTimeout(r, 0));
        }
      }
    }
  }

  getFilterResult(element) {
    if (this.sorters.text != '') {
      const strings = this.sorters.text.split(',');

      for (const string of strings) {
        if (string.indexOf(':') == -1) {
          if ($(element).find('.item-name a')[0].innerHTML.toLowerCase().indexOf(string.toLowerCase().trim()) == -1) {
            return false;
          }
        } else {
          const targetValue = string.split(':')[1].trim();
          const targetStat = string.split(':')[0].trim();

          if ($(element).find(`input[name=${targetStat}]`).val().toLowerCase().indexOf(targetValue) == -1) {
            return false;
          }
        }
      }
    }

    if (this.sorters.castingtime != 'null') {
      const castingtime = $(element).find('input[name=time]').val().toLowerCase();

      if (castingtime != this.sorters.castingtime) {
        return false;
      }
    }

    for (let availableFilter of Object.values(this.filters)) {
      if (availableFilter.activeFilters && availableFilter.activeFilters.length > 0) {
        if (!availableFilter.filter(element, availableFilter.activeFilters)) {
          return false;
        }
      }
    }

    return true;
  }

  clearObject(obj) {
    const newObj = {};

    for (const key in obj) {
      if (obj[key] == true) {
        newObj[key] = true;
      }
    }

    return newObj;
  }

  resetFilters(html) {
    this.sorters = {
      text: '',
      castingtime: 'null'
    };
    for (let filterKey of Object.keys(this.filters)) {
      this.filters[filterKey].activeFilters = [];
    }
    html.find('input[name=textFilter]').val('');
    html.find('input[name=timefilter]').val('null');
    html.find('input[type=checkbox]').prop('checked', false);
  }
  /* -------------------------------------------- */
  getPacksToLoad() {
    return [];
  }

  get _loadedPacks() {
    return this.getPacksToLoad().flatMap(([collection, {
      load
    }]) => {
      return load ? [collection] : [];
    });
  }
}
