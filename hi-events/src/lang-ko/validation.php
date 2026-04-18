<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Validation Language Lines
    |--------------------------------------------------------------------------
    |
    | The following language lines contain the default error messages used by
    | the validator class. Some of these rules have multiple versions such
    | as the size rules. Feel free to tweak each of these messages here.
    |
    */

    'accepted' => ':attribute 항목을 동의해야 합니다.',
    'accepted_if' => ':other이(가) :value일 때 :attribute 항목을 동의해야 합니다.',
    'active_url' => ':attribute 항목은 유효한 URL이어야 합니다.',
    'after' => ':attribute 항목은 :date 이후의 날짜여야 합니다.',
    'after_or_equal' => ':attribute 항목은 :date 또는 그 이후의 날짜여야 합니다.',
    'alpha' => ':attribute 항목은 문자만 포함할 수 있습니다.',
    'alpha_dash' => ':attribute 항목은 문자, 숫자, 대시(-), 밑줄(_)만 포함할 수 있습니다.',
    'alpha_num' => ':attribute 항목은 문자와 숫자만 포함할 수 있습니다.',
    'array' => ':attribute 항목은 배열이어야 합니다.',
    'ascii' => ':attribute 항목은 단일 바이트 영숫자 및 기호만 포함할 수 있습니다.',
    'before' => ':attribute 항목은 :date 이전의 날짜여야 합니다.',
    'before_or_equal' => ':attribute 항목은 :date 또는 그 이전의 날짜여야 합니다.',
    'between' => [
        'array' => ':attribute 항목은 :min개 이상 :max개 이하의 항목을 가져야 합니다.',
        'file' => ':attribute 항목은 :min KB 이상 :max KB 이하이어야 합니다.',
        'numeric' => ':attribute 항목은 :min 이상 :max 이하이어야 합니다.',
        'string' => ':attribute 항목은 :min자 이상 :max자 이하이어야 합니다.',
    ],
    'boolean' => ':attribute 항목은 true 또는 false여야 합니다.',
    'confirmed' => ':attribute 확인이 일치하지 않습니다.',
    'current_password' => '비밀번호가 올바르지 않습니다.',
    'date' => ':attribute 항목은 유효한 날짜여야 합니다.',
    'date_equals' => ':attribute 항목은 :date와(과) 같은 날짜여야 합니다.',
    'date_format' => ':attribute 항목은 :format 형식과 일치해야 합니다.',
    'decimal' => ':attribute 항목은 소수점 이하 :decimal자리여야 합니다.',
    'declined' => ':attribute 항목을 거절해야 합니다.',
    'declined_if' => ':other이(가) :value일 때 :attribute 항목을 거절해야 합니다.',
    'different' => ':attribute와(과) :other은(는) 서로 달라야 합니다.',
    'digits' => ':attribute 항목은 :digits 자리 숫자여야 합니다.',
    'digits_between' => ':attribute 항목은 :min자리 이상 :max자리 이하의 숫자여야 합니다.',
    'dimensions' => ':attribute 항목의 이미지 크기가 올바르지 않습니다.',
    'distinct' => ':attribute 항목에 중복된 값이 있습니다.',
    'doesnt_end_with' => ':attribute 항목은 다음 중 하나로 끝날 수 없습니다: :values.',
    'doesnt_start_with' => ':attribute 항목은 다음 중 하나로 시작할 수 없습니다: :values.',
    'email' => ':attribute 항목은 유효한 이메일 주소여야 합니다.',
    'ends_with' => ':attribute 항목은 다음 중 하나로 끝나야 합니다: :values.',
    'enum' => '선택하신 :attribute 항목이 유효하지 않습니다.',
    'exists' => '선택하신 :attribute 항목이 유효하지 않습니다.',
    'file' => ':attribute 항목은 파일이어야 합니다.',
    'filled' => ':attribute 항목에는 값이 있어야 합니다.',
    'gt' => [
        'array' => ':attribute 항목은 :value개를 초과하는 항목을 가져야 합니다.',
        'file' => ':attribute 항목은 :value KB보다 커야 합니다.',
        'numeric' => ':attribute 항목은 :value보다 커야 합니다.',
        'string' => ':attribute 항목은 :value자보다 길어야 합니다.',
    ],
    'gte' => [
        'array' => ':attribute 항목은 :value개 이상의 항목을 가져야 합니다.',
        'file' => ':attribute 항목은 :value KB 이상이어야 합니다.',
        'numeric' => ':attribute 항목은 :value 이상이어야 합니다.',
        'string' => ':attribute 항목은 :value자 이상이어야 합니다.',
    ],
    'image' => ':attribute 항목은 이미지여야 합니다.',
    'in' => '선택하신 :attribute 항목이 유효하지 않습니다.',
    'in_array' => ':attribute 항목은 :other에 존재해야 합니다.',
    'integer' => ':attribute 항목은 정수여야 합니다.',
    'ip' => ':attribute 항목은 유효한 IP 주소여야 합니다.',
    'ipv4' => ':attribute 항목은 유효한 IPv4 주소여야 합니다.',
    'ipv6' => ':attribute 항목은 유효한 IPv6 주소여야 합니다.',
    'json' => ':attribute 항목은 유효한 JSON 문자열이어야 합니다.',
    'lowercase' => ':attribute 항목은 소문자여야 합니다.',
    'lt' => [
        'array' => ':attribute 항목은 :value개 미만의 항목을 가져야 합니다.',
        'file' => ':attribute 항목은 :value KB보다 작아야 합니다.',
        'numeric' => ':attribute 항목은 :value보다 작아야 합니다.',
        'string' => ':attribute 항목은 :value자보다 짧아야 합니다.',
    ],
    'lte' => [
        'array' => ':attribute 항목은 :value개 이하의 항목을 가져야 합니다.',
        'file' => ':attribute 항목은 :value KB 이하여야 합니다.',
        'numeric' => ':attribute 항목은 :value 이하여야 합니다.',
        'string' => ':attribute 항목은 :value자 이하여야 합니다.',
    ],
    'mac_address' => ':attribute 항목은 유효한 MAC 주소여야 합니다.',
    'max' => [
        'array' => ':attribute 항목은 :max개 이하의 항목을 가져야 합니다.',
        'file' => ':attribute 항목은 :max KB를 초과할 수 없습니다.',
        'numeric' => ':attribute 항목은 :max를 초과할 수 없습니다.',
        'string' => ':attribute 항목은 :max자를 초과할 수 없습니다.',
    ],
    'max_digits' => ':attribute 항목은 :max자리를 초과할 수 없습니다.',
    'mimes' => ':attribute 항목은 다음 타입의 파일이어야 합니다: :values.',
    'mimetypes' => ':attribute 항목은 다음 타입의 파일이어야 합니다: :values.',
    'min' => [
        'array' => ':attribute 항목은 최소 :min개의 항목을 가져야 합니다.',
        'file' => ':attribute 항목은 최소 :min KB여야 합니다.',
        'numeric' => ':attribute 항목은 최소 :min이어야 합니다.',
        'string' => ':attribute 항목은 최소 :min자여야 합니다.',
    ],
    'min_digits' => ':attribute 항목은 최소 :min자리여야 합니다.',
    'missing' => ':attribute 항목은 존재하지 않아야 합니다.',
    'missing_if' => ':other이(가) :value일 때 :attribute 항목은 존재하지 않아야 합니다.',
    'missing_unless' => ':other이(가) :value이 아닌 한 :attribute 항목은 존재하지 않아야 합니다.',
    'missing_with' => ':values이(가) 있을 때 :attribute 항목은 존재하지 않아야 합니다.',
    'missing_with_all' => ':values이(가) 모두 있을 때 :attribute 항목은 존재하지 않아야 합니다.',
    'multiple_of' => ':attribute 항목은 :value의 배수여야 합니다.',
    'not_in' => '선택하신 :attribute 항목이 유효하지 않습니다.',
    'not_regex' => ':attribute 항목의 형식이 올바르지 않습니다.',
    'numeric' => ':attribute 항목은 숫자여야 합니다.',
    'password' => [
        'letters' => ':attribute 항목에는 최소 한 개의 문자가 포함되어야 합니다.',
        'mixed' => ':attribute 항목에는 최소 한 개의 대문자와 한 개의 소문자가 포함되어야 합니다.',
        'numbers' => ':attribute 항목에는 최소 한 개의 숫자가 포함되어야 합니다.',
        'symbols' => ':attribute 항목에는 최소 한 개의 기호가 포함되어야 합니다.',
        'uncompromised' => '입력하신 :attribute은(는) 데이터 유출에 노출된 적이 있습니다. 다른 :attribute을(를) 선택해 주세요.',
    ],
    'present' => ':attribute 항목이 존재해야 합니다.',
    'prohibited' => ':attribute 항목은 허용되지 않습니다.',
    'prohibited_if' => ':other이(가) :value일 때 :attribute 항목은 허용되지 않습니다.',
    'prohibited_unless' => ':other이(가) :values에 포함되지 않는 한 :attribute 항목은 허용되지 않습니다.',
    'prohibits' => ':attribute 항목이 있으면 :other 항목을 사용할 수 없습니다.',
    'regex' => ':attribute 항목의 형식이 올바르지 않습니다.',
    'required' => ':attribute 항목은 필수입니다.',
    'required_array_keys' => ':attribute 항목에는 :values 에 해당하는 값이 포함되어야 합니다.',
    'required_if' => ':other이(가) :value일 때 :attribute 항목은 필수입니다.',
    'required_if_accepted' => ':other이(가) 동의된 경우 :attribute 항목은 필수입니다.',
    'required_unless' => ':other이(가) :values에 포함되지 않는 한 :attribute 항목은 필수입니다.',
    'required_with' => ':values이(가) 있을 때 :attribute 항목은 필수입니다.',
    'required_with_all' => ':values이(가) 모두 있을 때 :attribute 항목은 필수입니다.',
    'required_without' => ':values이(가) 없을 때 :attribute 항목은 필수입니다.',
    'required_without_all' => ':values 중 어느 것도 없을 때 :attribute 항목은 필수입니다.',
    'same' => ':attribute와(과) :other은(는) 일치해야 합니다.',
    'size' => [
        'array' => ':attribute 항목은 :size개의 항목을 포함해야 합니다.',
        'file' => ':attribute 항목은 :size KB여야 합니다.',
        'numeric' => ':attribute 항목은 :size여야 합니다.',
        'string' => ':attribute 항목은 :size자여야 합니다.',
    ],
    'starts_with' => ':attribute 항목은 다음 중 하나로 시작해야 합니다: :values.',
    'string' => ':attribute 항목은 문자열이어야 합니다.',
    'timezone' => ':attribute 항목은 유효한 시간대여야 합니다.',
    'unique' => ':attribute은(는) 이미 사용 중입니다.',
    'uploaded' => ':attribute 업로드에 실패했습니다.',
    'uppercase' => ':attribute 항목은 대문자여야 합니다.',
    'url' => ':attribute 항목은 유효한 URL이어야 합니다.',
    'ulid' => ':attribute 항목은 유효한 ULID여야 합니다.',
    'uuid' => ':attribute 항목은 유효한 UUID여야 합니다.',

    /*
    |--------------------------------------------------------------------------
    | Custom Validation Language Lines
    |--------------------------------------------------------------------------
    |
    | Here you may specify custom validation messages for attributes using the
    | convention "attribute.rule" to name the lines. This makes it quick to
    | specify a specific custom language line for a given attribute rule.
    |
    */

    'custom' => [
        'attribute-name' => [
            'rule-name' => 'custom-message',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Custom Validation Attributes
    |--------------------------------------------------------------------------
    |
    | The following language lines are used to swap our attribute placeholder
    | with something more reader friendly such as "E-Mail Address" instead
    | of "email". This simply helps us make our message more expressive.
    |
    */

    'attributes' => [],

];
