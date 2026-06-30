import React, { useState, useMemo } from 'react';
import bridge from '@vkontakte/vk-bridge';

// Отправляет событие инициализации нативному клиенту
bridge.send("VKWebAppInit");
import {
  AppRoot,
  SplitLayout,
  SplitCol,
  View,
  Panel,
  PanelHeader,
  Group,
  SimpleCell,
  usePlatform,
  Footer,
  Search,
  CellButton,
  ModalRoot,
  ModalCard,
  Text,
  Button,
  CustomSelect,
  Header,
  Cell
} from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import { Icon20Cancel, Icon24ChevronRight, Icon24FolderOutline, Icon24DocumentOutline } from '@vkontakte/icons';

import icd10Data from './icd10.json';


const App = () => {
  const platform = usePlatform();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResult, setSelectedResult] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [searchType, setSearchType] = useState('all');
  const [expandedSections, setExpandedSections] = useState({});

  // Поиск по дереву
  const searchInNode = (node, query, path = '') => {
    if (!node) return [];

    const currentPath = path ? `${path} > ${node.code}` : node.code;
    const results = [];

    const matches = (str, query) =>
      str.toLowerCase().includes(query.toLowerCase());

    let isMatch = false;
    if (searchType === 'code' && matches(node.code, query)) isMatch = true;
    else if (searchType === 'title' && matches(node.title, query)) isMatch = true;
    else if (searchType === 'all' && (matches(node.code, query) || matches(node.title, query))) isMatch = true;

    if (isMatch && query.length > 0) {
      results.push({
        id: node.id,
        code: node.code,
        title: node.title,
        path: currentPath,
        isRoot: node.children.length === 0,
        node: node
      });
    }

    if (node.children) {
      for (const child of node.children) {
        results.push(...searchInNode(child, query, currentPath));
      }
    }

    return results;
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const allResults = [];
    for (const root of icd10Data) {
      allResults.push(...searchInNode(root, searchQuery));
    }

    const seen = new Set();
    return allResults.filter(item => {
      const key = item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [searchQuery, searchType]);

  const handleSelectResult = (result) => {
    const findNode = (nodes, id) => {
      for (const node of nodes) {
        if (node.id === id) return node;
        const found = findNode(node.children, id);
        if (found) return found;
      }
      return null;
    };

    for (const root of icd10Data) {
      const node = findNode([root], result.id);
      if (node) {
        setSelectedResult(node);
        setActiveModal('result-modal');
        break;
      }
    }
  };

  const toggleSection = (id) => {
    setExpandedSections(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Рендер дерева
  const renderTree = (nodes, level = 0) => {
    return nodes.map((node) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedSections[node.id];

      return (
        <React.Fragment key={node.id}>
          <Cell
            before={hasChildren ? <Icon24FolderOutline /> : <Icon24DocumentOutline />}
            after={hasChildren && <Icon24ChevronRight style={{
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s'
            }} />}
            onClick={() => {
              if (hasChildren) {
                toggleSection(node.id);
              } else {
                setSelectedResult(node);
                setActiveModal('result-modal');
              }
            }}
            description={node.code}
            style={{
              paddingLeft: `${level * 20 + 12}px`,
              cursor: 'pointer'
            }}
          >
            <div style={{
              fontWeight: hasChildren ? '500' : 'normal',
              fontSize: hasChildren ? '15px' : '14px'
            }}>
              {node.title}
            </div>
          </Cell>
          {hasChildren && isExpanded && (
            <div style={{ marginLeft: '8px' }}>
              {renderTree(node.children, level + 1)}
            </div>
          )}
        </React.Fragment>
      );
    });
  };

  // Функция для получения цветовой индикации уровня вложенности
  const getLevelColor = (path) => {
    const parts = path.split(' > ');
    if (parts.length <= 2) return 'var(--vkui--color_text_secondary)';
    if (parts.length <= 4) return 'var(--vkui--color_text_subhead)';
    return 'var(--vkui--color_text_tertiary)';
  };

  return (
    <AppRoot>
      <SplitLayout header={platform !== 'vkcom' && <PanelHeader delimiter="none" />}>
        <SplitCol autoSpaced>
          <View activePanel="main">
            <Panel id="main">
              <PanelHeader>МКБ-10</PanelHeader>

              <Group>
                <div>
                  <Search
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    after={searchQuery && (
                      <Icon20Cancel
                        onClick={() => setSearchQuery('')}
                        style={{ cursor: 'pointer' }}
                      />
                    )}
                    placeholder="Введите код или название..."
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <CustomSelect
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value)}
                    options={[
                      { value: 'all', label: 'Все' },
                      { value: 'code', label: 'По коду' },
                      { value: 'title', label: 'По названию' }
                    ]}
                    style={{ flex: 1 }}
                  />
                </div>
              </Group>

              {searchQuery ? (
                <>
                  <Group>
                    {searchResults.length > 0 && (
                      <SimpleCell>
                        Найдено: {searchResults.length}
                      </SimpleCell>
                    )}

                    {searchResults.length === 0 && (
                      <SimpleCell>
                        Ничего не найдено
                      </SimpleCell>
                    )}

                    {searchResults.slice(0, 20).map((result) => (
                      <CellButton
                        key={result.id}
                        onClick={() => handleSelectResult(result)}
                        description={result.path}
                        style={{
                          color: getLevelColor(result.path)
                        }}
                      >
                        <span style={{ fontWeight: result.isRoot ? 'bold' : 'normal' }}>
                          {result.code} — {result.title}
                        </span>
                      </CellButton>
                    ))}

                    {searchResults.length > 20 && (
                      <SimpleCell>
                        ... и еще {searchResults.length - 20} результатов
                      </SimpleCell>
                    )}
                  </Group>
                </>
              ) : (
                // Дерево МКБ-10
                <Group>
                  {renderTree(icd10Data)}
                </Group>
              )}
            </Panel>
          </View>
        </SplitCol>
      </SplitLayout>

      {/* Модальное окно для отображения полной информации */}
      <ModalRoot activeModal={activeModal}>
        <ModalCard
          id="result-modal"
          onClose={() => setActiveModal(null)}
          header={selectedResult?.code || ''}
          subheader={selectedResult?.title || ''}
        >
          {selectedResult && (
            <>
              <Group>
                <SimpleCell>
                  <Text weight="2" style={{ marginBottom: 4 }}>Код: {selectedResult.code}</Text>
                </SimpleCell>
                <SimpleCell>
                  <Text weight="1" style={{ marginBottom: 4 }}>Название: {selectedResult.title}</Text>
                </SimpleCell>
                {selectedResult.children && selectedResult.children.length > 0 && (
                  <SimpleCell>
                    <Text weight="2">Вложенных элементов: {selectedResult.children.length}</Text>
                  </SimpleCell>
                )}
                {selectedResult.children && selectedResult.children.length === 0 && (
                  <SimpleCell>
                    <Text weight="2">Конечный узел (без вложений)</Text>
                  </SimpleCell>
                )}
              </Group>

              {selectedResult.children && selectedResult.children.length > 0 && (
                <Group header={<Header size="s">Дочерние элементы</Header>}>
                  {selectedResult.children.slice(0, 20).map((child) => (
                    <SimpleCell key={child.id} description={child.code}>
                      {child.title}
                    </SimpleCell>
                  ))}
                  {selectedResult.children.length > 20 && (
                    <SimpleCell>
                      ... и еще {selectedResult.children.length - 20} элементов
                    </SimpleCell>
                  )}
                </Group>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Button
                  size="l"
                  stretched
                  onClick={() => setActiveModal(null)}
                >
                  Закрыть
                </Button>
              </div>
            </>
          )}
        </ModalCard>
      </ModalRoot>

      <Footer>Международная классификация болезней МКБ-10</Footer>
    </AppRoot>
  );
};

export default App;