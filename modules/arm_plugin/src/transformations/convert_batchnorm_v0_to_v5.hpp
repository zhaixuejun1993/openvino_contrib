// Copyright (C) 2020-2023 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

#pragma once

#include <ngraph/pass/graph_rewrite.hpp>

namespace ArmPlugin {
namespace pass {

class ConvertBatchNormInferenceV0toV5;

} // namespace pass
} // namespace ArmPlugin

class ArmPlugin::pass::ConvertBatchNormInferenceV0toV5 : public ngraph::pass::MatcherPass {
public:
    OPENVINO_OP("ConvertBatchNormInferenceV0toV5");
    ConvertBatchNormInferenceV0toV5();
};
