<?php
	App::uses('User', 'Model');

	class RealtimeFormComponent extends Component {
		private function getModel($modelName, $controller, $target) {
			if ($modelName == $target) {
				return $controller->{$modelName};
			} else {
				$model = $controller->{$target};
				if (!$model) $model = $controller->{$modelName}->{$target};
				return $model;
			}
		}

		public function update($id, $modelName, $controller) {
			$controller->{$modelName}->id = $id;
			if (!$controller->{$modelName}->exists()) {
				throw new NotFoundException();
			}
			if (!$controller->{$modelName}->isOwner()) {
				throw new ForbiddenException(__('Invalid operation'));
			}

			$data = $controller->request->input('json_decode', true);

			if ($data && is_array($data) && array_key_exists('model', $data)) {
				$model = null;
				if ($data['model'] == $modelName) {
					$model = $controller->{$modelName};
				} else if (array_key_exists('id', $data)) {
					$model = $this->getModel($modelName, $controller, $data['model']);
					if ($model) $model->id = $data['id'];
				}

				if ($model) {
					$model->saveField($data['field'], $data['value']);
				} else {
					throw new ForbiddenException(__('Invalid operation'));
				}

				$controller->{$modelName}->recursive = 3;
				$controller->set('data', $controller->{$modelName}->findById($id));
				$controller->set('_serialize', 'data');
			}
		}

		public function append($id = null, $modelName, $controller) {
			$controller->{$modelName}->id = $id;
			if (!$controller->{$modelName}->exists()) {
				throw new NotFoundException();
			}
			if (!$controller->{$modelName}->isOwner()) {
				throw new ForbiddenException(__('Invalid operation'));
			}

			$data = $controller->request->input('json_decode', true);

			$insert_id = null;
			if ($data && is_array($data) && array_key_exists('model', $data)) {
				$model = $this->getModel($modelName, $controller, $data['model']);

				if ($model) {
					$model->create();
					$model->set(Inflector::underscore($modelName) . '_id', $id);
					$model->save();
					$insert_id = $model->getInsertID();
				} else {
					throw new ForbiddenException(__('Invalid operation'));
				}
			}

			if ($insert_id) {
				$controller->set('id', $insert_id);
				$controller->set('_serialize', 'id');
			}

		}

		public function remove($id = null, $modelName, $controller) {
			$controller->{$modelName}->id = $id;
			if (!$controller->{$modelName}->exists()) {
				throw new NotFoundException();
			}
			if (!$controller->{$modelName}->isOwner()) {
				throw new ForbiddenException(__('Invalid operation'));
			}

			$data = $controller->request->input('json_decode', true);

			if ($data && is_array($data) && array_key_exists('model', $data)) {
				$model = $this->getModel($modelName, $controller, $data['model']);

				if ($model && array_key_exists('id', $data)) {
					$model->delete($data['id']);
					$controller->set('result', 'OK');
					$controller->set('_serialize', 'result');
				} else {
					throw new ForbiddenException(__('Invalid operation'));
				}
			}
		}
	}
