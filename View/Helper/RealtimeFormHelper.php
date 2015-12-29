<?php
	App::uses('Helper', 'AppHelper');

	class RealtimeFormHelper extends AppHelper {
		public $helpers = array('Html');

		private $scriptWritten = false;
		private $columnTypesList = array();
		private $topLevel = true;
		private $sp = -1;
		private $stack = array();

		public $readonly = false;
		public $containerTag = 'div';
		public $model;
		public $data;

		public $tableData;
		public $tableModel;
		public $tablePath;
		public $tableColumns;
		public $tableOptions;

		private function push() {
			$this->stack[++$this->sp] = array(
				'readonly' => $this->readonly,
				'containerTag' => $this->containerTag,
				'model' => $this->model,
				'data' => $this->data,
			);
		}

		private function pop() {
			if ($this->sp >= 0) {
				$this->readonly = $this->stack[$this->sp]['readonly'];
				$this->containerTag = $this->stack[$this->sp]['containerTag'];
				$this->model = $this->stack[$this->sp]['model'];
				$this->data = $this->stack[$this->sp]['data'];

				unset($this->stack[$this->sp--]);
			}
		}

		private function appendWithArray($key, $value, &$options) {
			if ($options && is_array($options) && array_key_exists('class', $options)) {
				$options[$key] = array(
					$options[$key],
					$value,
				);
			} else {
				$options[$key] = $value;
			}
		}

		private function getOption(&$options, $key, $default = null) {
			if ($options && is_array($options) && array_key_exists($key, $options)) {
				$option = $options[$key];
				unset($options[$key]);
			} else {
				$option = $default;
			}
			return $option;
		}

		function create($model, $data, $options = array()) {
			if ($this->topLevel) $this->topLevel = false;
			else $this->push();

			$this->model = $model;
			$this->data = $data;

			$this->readonly = $this->getOption($options, 'readonly', $this->readonly);
			$this->containerTag = $this->getOption($options, 'tag', $this->containerTag);

			
			$this->appendWithArray('class', 'rtf', $options);
			if ($data && is_array($data)) {
				$modelData = Hash::extract($data, $model);
				if ($modelData && array_key_exists('id', $modelData)) {
					$options['data-id'] = $modelData['id'];
				} else if (array_key_exists('id', $data)) {
					$options['data-id'] = $data['id'];
				}
			}

			$options['data-model'] = $model;

			$html = $this->Html->tag($this->containerTag, null, $options);

			if (!$this->scriptWritten) {
				$this->Html->script('RealtimeForm.realtimeform', array('inline' => false));
				$this->Html->css('RealtimeForm.realtimeform', array('inline' => false));

				$html = '<script>'
					. "var updateURL = \"{$this->Html->url(array('action' => 'update', $options['data-id']))}.json\";"
					. "var appendURL = \"{$this->Html->url(array('action' => 'append', $options['data-id']))}.json\";"
					. "var removeURL = \"{$this->Html->url(array('action' => 'remove', $options['data-id']))}.json\";"
					. '</script>'
				. $html;

				$this->scriptWritten = true;
			}

			return $html;
		}

		function end() {
			$html = $this->Html->tag($this->containerTag, null);

			$this->pop();
			return str_replace('<', '</', $html);
		}

		function element($path, $options = array()) {
			$defaultTag = 'div';

			if ($this->readonly || $this->getOption($options, 'readonly', false)) {
				$this->appendWithArray('class', 'rtf-readonly', $options);
			} else {
				$this->appendWithArray('class', 'rtf-control', $options);
			}

			$value = Hash::get($this->data, $path);
			if (!$value) {
				$path = $this->model . '.' . $path;
				$value = Hash::get($this->data, $path);
			}

			$name = null;
			$type = $this->getOption($options, 'type', 'text');
			$link = $this->getOption($options, 'link', true);

			$list_options = $this->getOption($options, 'options', true);
			$empty = $this->getOption($options, 'empty', false);

			if (is_array($list_options)) {
				$list = $list_options;

				if ($empty) {
					if ($empty === true) $empty = '';

					$list = Hash::merge(array(null => $empty), $list);
				}

				if ($list && is_array($list)) {
					if (array_key_exists($value, $list)) $name = $list[$value];
					$options['data-list'] = json_encode($list);
				}
			} else if ($list_options && preg_match('/([^\.]+)_id$/', $path, $matches)) {
				$varName = $this->getOption($options, 'controller', Inflector::pluralize($matches[1]));
				$namePath = $this->getOption($options, 'name_path', Inflector::camelize($matches[1]) . '.' . 'name');

				if ($link) {
					$defaultTag = 'a';
					$link_plugin = $this->getOption($options, 'plugin', false);
					$url = array(
						'controller' => $varName, 
						'action' => 'view',
						Hash::get($this->data, $this->model . '.' . $matches[1] . '_id')
					);
					if ($link_plugin !== false) {
						$url['plugin'] = $link_plugin;
					}
					$options['href'] = $this->Html->url($url);
				}

				$name = Hash::get($this->data, $namePath);
				$type = null;

				$list = $this->_View->getVar($varName);

				if ($empty) {
					if ($empty === true) $empty = '';

					$list = Hash::merge(array(null => $empty), $list);
				}

				if ($list && is_array($list)) {
					if (array_key_exists($value, $list)) $name = $list[$value];
					$options['data-list'] = json_encode($list);
				}
			}

			$tag = $this->getOption($options, 'tag', $defaultTag);

			if ($value == null) {
				$value = '';
			}

			$options['data-path'] = $this->getOption($options, 'path', $path);
			if ($name) {
				$options['data-value'] = $value;
			}

			if ($type == 'text') {
				$sPath = explode('.', $path);
				if (count($sPath) >= 2) {
					$modelName = $sPath[count($sPath)-2];
					$fieldName = $sPath[count($sPath)-1];
				} else if (count($sPath) == 1) {
					$modelName = $this->model;
					$fieldName = $sPath[0];
				}

				$columnTypes = null;
				if ($modelName && !empty($modelName)) {
					if (array_key_exists($modelName, $this->columnTypesList)) {
						$columnTypes = $this->columnTypesList[$modelName];
					} else {
						try {
							$model = ClassRegistry::init($modelName);
							if ($model) {
								$columnTypes = $model->getColumnTypes();
								$this->columnTypesList[$modelName] = $columnTypes;
							}
						}catch (Exception $e) {
						}
					}

					if ($columnTypes && array_key_exists($fieldName, $columnTypes)) {
						$fieldType = $columnTypes[$fieldName];
						switch ($fieldType) {
							case 'integer':
							$type = 'number';
							break;
							case 'boolean':
							$type = 'checkbox';
							break;
							case 'text':
							$type = 'textarea';
							break;
							case 'string':
							break;
							default:
							//var_dump($fieldType);
							break;
						}
					}
				}
			}

			if ($type == 'checkbox') {
				$tag = 'input';
				$options['type'] = 'checkbox';
				if ($value) {
					$options['checked'] = true;
				}
				$name = $value = null;
				$options['onclick'] = 'event.preventDefault()';
			} 
			if  ($type) {
				$options['data-type'] = $type;
			}

			return $this->Html->tag($tag, $name ? $name : nl2br($value), $options);
		}

		function createTable($data, $model, $tableColumns, $options = array()) {
			$this->tableData = $data;
			$this->tableModel = $model;
			$this->tablePath = "{$model}.{n}";
			$this->tableColumns = $tableColumns;

			$class = $this->getOption($options, 'class', '');

			$this->tableOptions = $options;

			return "<table class=\"$class\">";
		}

		function tableHeader($putHeaderTag = false) {
			$html = '';
			if ($putHeaderTag) $html .= '<thead><tr>';
			foreach ($this->tableColumns as $column) $html .= "<th>{$column['name']}</th>";
			if ($putHeaderTag) $html .= '</thead></tr>';
			return $html;
		}

		private function tableColumn($n, $pathBase, $column) {
			$html = '<td>';
				if ($n == 0 && !Hash::get($this->tableOptions, 'readonly')) {
					$html .= '<button class="btn btn-xs btn-danger rtf-remove pull-left" style="display: none"> <span class="glyphicon glyphicon-remove"></span> </button>';
				}

				if (array_key_exists('root', $column) && $column['root']) {
					$this->push();

					$options = array();

					if (array_key_exists('options', $column)) {
						$options = array_merge($options, $column['options']);
					}

					$this->data = $this->stack[$this->sp-1]['data'];
					$this->model = $this->stack[$this->sp-1]['model'];
					unset($options['path']);
					$html .= $this->element($column['path'], $options);
					$this->pop();
				} else {
					$options = array(
						'path' => $pathBase . $column['path']
					);

					if (array_key_exists('options', $column)) {
						$options = array_merge($options, $column['options']);
					}
					$html .= $this->element($column['path'], $options);
				}

				$html .= '</td>';

			return $html;
		}

		function tableBody($putBodyTag = false) {
			$html = '';

			if ($putBodyTag) $html .= '<tbody>';

				foreach (Hash::extract($this->tableData, $this->tablePath) as $n => $data) {
					$pathBase = str_replace('{n}', $n, $this->tablePath) . '.';
					$html .= $this->create($this->tableModel, $data, array_merge($this->tableOptions, array(
						'tag' => 'tr',
						'data-id' => $data['id'],
					)));

					foreach ($this->tableColumns as $n => $column) {
						$html .= $this->tableColumn($n, $pathBase, $column);
					}
					$html .= $this->end();
				}


				if ($putBodyTag) $html .= '</tbody>';
			return $html;
		}

		function tableFooter($putFootTag = false) {
			$html = '';

			if ($putFootTag) $html .= '<tfoot>';


				if (!Hash::get($this->tableOptions, 'readonly')) {
					$pathBase = $this->tablePath . '.';

					$html .= $this->create($this->tableModel, array(), array(
						'tag' => 'tr',
						'class' => 'rtf-template',
						'style' => 'display: none;',
						'id' => null,
					));

					foreach ($this->tableColumns as $n => $column) {
						$html .= $this->tableColumn($n, $pathBase, $column);
					}

					$html .= $this->end();


					$html .= '<tr> <td colspan="' . count($this->tableColumns) . '"> <button class="btn btn-xs btn-default rtf-append pull-right"> <span class="glyphicon glyphicon-plus"></span> </button> </td> </tr>';
				}

				if ($putFootTag) $html .= '</tfoot>';

			return $html;
		}

		function endTable() {
			return '</table>';
		}

		function simpleTable($data, $model, $tableColumns, $options = array()) {
			return $this->createTable($data, $model, $tableColumns, $options)
			. $this->tableHeader(true)
			. $this->tableBody(true)
			. $this->tableFooter(true)
			. $this->endTable();
		}
	}
